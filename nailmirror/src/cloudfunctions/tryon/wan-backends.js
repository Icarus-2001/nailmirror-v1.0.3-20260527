// 万相 2.1 Mask + 2.7 双图/bbox 后端
// 稳定策略：0531-stable — 见 docs/TRYON_0531稳定出图策略.md（与 config/tryon-strategy.js 同步）
const TRYON_STRATEGY_ID = '0531-stable';

const https = require('https');
const { URL } = require('url');

const DASH_BASE = 'https://dashscope.aliyuncs.com';

const SUPPORTED_MODELS = ['wanx2.1-imageedit', 'wan2.7-image-pro'];
const BACKEND_MASK = 'mask_inpaint';
const BACKEND_MM = 'multimodal_edit';

function getEnv(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === null || v === '') return fallback;
  return v;
}

function httpJson(method, urlStr, headers, bodyObj) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const body = bodyObj ? JSON.stringify(bodyObj) : null;
    const opts = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: method,
      headers: Object.assign({}, headers || {}, body ? {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      } : {})
    };
    const req = https.request(opts, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(raw || '{}'), raw });
        } catch (e) {
          reject(new Error('JSON 解析失败: ' + raw.slice(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(55000, () => req.destroy(new Error('HTTP 超时')));
    if (body) req.write(body);
    req.end();
  });
}

function normalizeModelName(raw) {
  if (raw === 'wan2.1-imageedit') return 'wanx2.1-imageedit';
  return raw;
}

function backendForModel(model) {
  if (model === 'wan2.7-image-pro' || model === 'wan2.7-image') return BACKEND_MM;
  return BACKEND_MASK;
}

function resolveWanModel(override) {
  const allowed = SUPPORTED_MODELS.concat(['wan2.7-image']);
  let raw = '';
  if (override) {
    raw = normalizeModelName(String(override).trim());
    if (allowed.indexOf(raw) === -1) {
      throw new Error('不支持的 wanModel: ' + override + '，可选: ' + SUPPORTED_MODELS.join(', '));
    }
  } else {
    raw = normalizeModelName(getEnv('WAN_IMAGE_MODEL', '') || getEnv('WANX_EDIT_MODEL', 'wanx2.1-imageedit'));
  }
  return { model: raw, backend: backendForModel(raw) };
}

function nailToBbox(n, width, height) {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const cx = (Number(n.cx) || 0.5) * w;
  const cy = (Number(n.cy) || 0.5) * h;
  const rx = (Number(n.rx) || 0.04) * w;
  const ry = (Number(n.ry) || 0.06) * h;
  return [
    Math.max(0, Math.floor(cx - rx)),
    Math.max(0, Math.floor(cy - ry)),
    Math.min(w - 1, Math.ceil(cx + rx)),
    Math.min(h - 1, Math.ceil(cy + ry))
  ];
}

function unionBbox(boxes) {
  if (!boxes.length) return null;
  let x1 = boxes[0][0];
  let y1 = boxes[0][1];
  let x2 = boxes[0][2];
  let y2 = boxes[0][3];
  for (let i = 1; i < boxes.length; i++) {
    x1 = Math.min(x1, boxes[i][0]);
    y1 = Math.min(y1, boxes[i][1]);
    x2 = Math.max(x2, boxes[i][2]);
    y2 = Math.max(y2, boxes[i][3]);
  }
  return [x1, y1, x2, y2];
}

/**
 * VL 指甲 → wan2.7 bbox_list（单图最多 2 框）。
 * 3 指及以上：所有指甲并成 1 个紧 bbox，避免左右半掌大框在指缝间生成「浮空甲」。
 * 1–2 指：各用单甲框。
 */
function mergeNailsToBboxList(nails, width, height) {
  const list = (nails || []).map((n) => nailToBbox(n, width, height));
  if (!list.length) return [];
  if (list.length <= 2) return list;
  const all = unionBbox(list);
  return all ? [all] : list.slice(0, 2);
}

function bboxListForImages(hasStyle, nails, width, height) {
  const handBoxes = mergeNailsToBboxList(nails, width, height);
  if (!handBoxes.length) throw new Error('未生成指甲框选区域');
  if (hasStyle) return [[], handBoxes];
  return [handBoxes];
}

function parseTaskOutput(output) {
  if (!output) return '';
  const results = output.results || [];
  if (results.length && results[0].url) return results[0].url;
  const choices = output.choices || [];
  if (choices.length) {
    const content = ((choices[0].message || {}).content) || [];
    for (let i = 0; i < content.length; i++) {
      if (content[i] && content[i].image) return content[i].image;
    }
  }
  return '';
}

function buildWan27Prompt(prompt, hasStyle) {
  const guard = 'Do not add floating nails or patterns in the background or between fingers. Edit only inside the boxes on existing fingernails.';
  if (hasStyle) {
    return [
      'Apply the nail art style from image 1 to the boxed fingernail areas in image 2 ONLY.',
      'Do not modify skin tone, fingers, knuckles, cuticles, or background.',
      guard,
      prompt
    ].join(' ');
  }
  return [
    'Repaint ONLY the boxed fingernail areas with bold salon gel nail polish.',
    'Do not modify skin, fingers, or background outside the boxes.',
    guard,
    prompt
  ].join(' ');
}

async function submitWithRetry(submitFn, prompt, retrySuffix) {
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const p = attempt === 0 ? prompt : (prompt + ' ' + retrySuffix);
      return await submitFn(p);
    } catch (e) {
      lastErr = e;
      console.warn('[wan] submit attempt', attempt + 1, 'fail', e.message);
    }
  }
  throw lastErr || new Error('万相提交失败');
}

async function submitWan21Mask(baseUrl, maskUrl, prompt, model) {
  const apiKey = getEnv('DASHSCOPE_API_KEY', '');
  if (!apiKey) throw new Error('缺少 DASHSCOPE_API_KEY 环境变量');
  console.log('[wan] mask_inpaint model=', model, 'prompt:', prompt.slice(0, 220));

  return submitWithRetry(async (p) => {
    const res = await httpJson('POST', DASH_BASE + '/api/v1/services/aigc/image2image/image-synthesis', {
      Authorization: 'Bearer ' + apiKey,
      'X-DashScope-Async': 'enable'
    }, {
      model,
      input: {
        function: 'description_edit_with_mask',
        prompt: p,
        base_image_url: baseUrl,
        mask_image_url: maskUrl
      },
      parameters: { n: 1, prompt_extend: true }
    });
    if (res.status >= 400) throw new Error('万相提交失败: ' + (res.raw || '').slice(0, 300));
    const taskId = ((res.data || {}).output || {}).task_id;
    if (!taskId) throw new Error('万相未返回 task_id');
    return taskId;
  }, prompt, 'Strong visible nail polish color, high contrast.');
}

async function submitWan27Dual(ctx) {
  const { baseUrl, styleUrl, prompt, nails, imageWidth, imageHeight, model } = ctx;
  const apiKey = getEnv('DASHSCOPE_API_KEY', '');
  if (!apiKey) throw new Error('缺少 DASHSCOPE_API_KEY 环境变量');
  const hasStyle = !!styleUrl;
  const mmPrompt = buildWan27Prompt(prompt, hasStyle);
  const bboxList = bboxListForImages(hasStyle, nails, imageWidth, imageHeight);
  const size = getEnv('WAN_IMAGE_SIZE', '') || '2K';

  const content = [];
  if (hasStyle) content.push({ image: styleUrl });
  content.push({ image: baseUrl });
  content.push({ text: mmPrompt });

  console.log('[wan] multimodal_edit model=', model, 'boxes=', bboxList[bboxList.length - 1].length);

  return submitWithRetry(async (p) => {
    const msgContent = content.slice(0, -1).concat([{ text: p }]);
    const res = await httpJson('POST', DASH_BASE + '/api/v1/services/aigc/image-generation/generation', {
      Authorization: 'Bearer ' + apiKey,
      'X-DashScope-Async': 'enable'
    }, {
      model,
      input: { messages: [{ role: 'user', content: msgContent }] },
      parameters: {
        bbox_list: bboxList,
        size,
        n: 1,
        watermark: false
      }
    });
    if (res.status >= 400) throw new Error('万相提交失败: ' + (res.raw || '').slice(0, 300));
    const taskId = ((res.data || {}).output || {}).task_id;
    if (!taskId) throw new Error('万相未返回 task_id');
    return taskId;
  }, mmPrompt, 'Strong visible nail polish color, high contrast.');
}

async function submitWanJob(ctx) {
  const resolved = resolveWanModel(ctx.wanModelOverride);
  const model = ctx.model || resolved.model;
  const backend = ctx.backend || resolved.backend;

  if (backend === BACKEND_MM) {
    return {
      taskId: await submitWan27Dual(Object.assign({}, ctx, { model, backend })),
      wanModel: model,
      wanBackend: backend
    };
  }
  if (!ctx.maskUrl) throw new Error('mask_inpaint 需要 maskUrl');
  return {
    taskId: await submitWan21Mask(ctx.baseUrl, ctx.maskUrl, ctx.prompt, model),
    wanModel: model,
    wanBackend: backend
  };
}

async function queryWanJob(taskId) {
  const apiKey = getEnv('DASHSCOPE_API_KEY', '');
  if (!apiKey) throw new Error('缺少 DASHSCOPE_API_KEY 环境变量');
  const res = await httpJson('GET', DASH_BASE + '/api/v1/tasks/' + taskId, {
    Authorization: 'Bearer ' + apiKey
  });
  const output = (res.data || {}).output || {};
  return {
    status: output.task_status || 'UNKNOWN',
    outputUrl: parseTaskOutput(output),
    message: output.message || output.code || ((res.data || {}).message) || ''
  };
}

module.exports = {
  TRYON_STRATEGY_ID,
  DASH_BASE,
  SUPPORTED_MODELS,
  BACKEND_MASK,
  BACKEND_MM,
  getEnv,
  resolveWanModel,
  mergeNailsToBboxList,
  bboxListForImages,
  parseTaskOutput,
  submitWanJob,
  queryWanJob
};
