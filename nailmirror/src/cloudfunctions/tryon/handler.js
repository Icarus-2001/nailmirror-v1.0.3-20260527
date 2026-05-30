// tryon 业务逻辑（依赖延迟加载，避免冷启动时 module 未安装导致 exports.main 未注册）
const https = require('https');
const { URL } = require('url');
const wanBackends = require('./wan-backends');

const DASH_BASE = wanBackends.DASH_BASE;
const BACKEND_MASK = wanBackends.BACKEND_MASK;
const MASK_SCALE = 1.28;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

let _cloud = null;
let _Jimp = null;
let _inited = false;

function getCloud() {
  if (!_cloud) {
    _cloud = require('wx-server-sdk');
    if (!_inited) {
      _cloud.init({ env: _cloud.DYNAMIC_CURRENT_ENV });
      _inited = true;
    }
  }
  return _cloud;
}

function getJimp() {
  if (!_Jimp) _Jimp = require('jimp');
  return _Jimp;
}

function ok(data) {
  return { code: 0, message: 'ok', data: data || {} };
}

function fail(message, data) {
  return { code: 1, message: message || 'error', data: data || {} };
}

function getEnv(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === null || v === '') return fallback;
  return v;
}

function extractJson(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) {
    const m = String(raw).match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch (e2) { return null; }
  }
}

function guessExt(buf) {
  if (buf && buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50) return 'png';
  return 'jpg';
}

function fillEllipse(image, cx, cy, rx, ry, color) {
  const w = image.bitmap.width;
  const h = image.bitmap.height;
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(w - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(h - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) image.setPixelColor(color, x, y);
    }
  }
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

function httpBuffer(urlStr) {
  return new Promise((resolve, reject) => {
    https.get(urlStr, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        reject(new Error('图片下载失败 HTTP ' + (res.statusCode || '?')));
        return;
      }
      const chunks = [];
      let total = 0;
      res.on('data', (c) => {
        total += c.length;
        if (total > MAX_IMAGE_BYTES) {
          res.destroy(new Error('图片过大，请压缩后重试（最大 8MB）'));
          return;
        }
        chunks.push(c);
      });
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

function allowAltImageInput() {
  return getEnv('TRYON_ALLOW_URL', '') === '1';
}

function assertImageSize(buf) {
  if (!buf || !buf.length) {
    throw new Error('图片为空，请重试');
  }
  if (buf.length > MAX_IMAGE_BYTES) {
    throw new Error('图片过大，请压缩后重试（最大 8MB）');
  }
}

async function getImageBufferFromFileID(fileID) {
  const cloud = getCloud();
  const r = await cloud.downloadFile({ fileID });
  if (!r.fileContent) throw new Error('下载图片失败');
  assertImageSize(r.fileContent);
  return r.fileContent;
}

async function resolveInputImage(event) {
  const { fileID, imageBase64, imageUrl, _internalUrl } = event || {};
  const altOk = allowAltImageInput();
  if (imageUrl) {
    // 云函数内部（如 submitTryonJob 已上传手照后的临时 URL）允许；仅拦截客户端直传
    if (!altOk && !_internalUrl) throw new Error('不支持 imageUrl，请使用云存储 fileID');
    return { type: 'url', value: imageUrl };
  }
  if (imageBase64) {
    if (!altOk && !_internalUrl) throw new Error('不支持 imageBase64，请使用云存储 fileID');
    const b64 = imageBase64.indexOf('data:') === 0
      ? imageBase64.replace(/^data:[^;]+;base64,/, '')
      : imageBase64;
    const buf = Buffer.from(b64, 'base64');
    assertImageSize(buf);
    return { type: 'buffer', value: buf };
  }
  if (fileID) {
    return { type: 'buffer', value: await getImageBufferFromFileID(fileID) };
  }
  throw new Error('缺少图片 fileID');
}

function requireOpenId() {
  const cloud = getCloud();
  const ctx = cloud.getWXContext();
  const openid = ctx && ctx.OPENID;
  if (!openid) throw new Error('未授权：请从小程序内调用');
  return openid;
}

async function uploadBufferGetUrl(buf, ext) {
  const cloud = getCloud();
  const cloudPath = 'tryon/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + (ext || 'jpg');
  const up = await cloud.uploadFile({ cloudPath, fileContent: buf });
  const temp = await cloud.getTempFileURL({ fileList: [up.fileID] });
  const item = temp.fileList && temp.fileList[0];
  if (!item || item.status !== 0) throw new Error('获取临时 URL 失败');
  return { fileID: up.fileID, url: item.tempFileURL };
}

async function imageInputToUrl(input) {
  if (input.type === 'url') return input.value;
  const r = await uploadBufferGetUrl(input.value, guessExt(input.value));
  return r.url;
}

function resultCloudPath(jobId, buf) {
  const safeJobId = String(jobId || Date.now()).replace(/[^\w.-]/g, '_');
  return 'tryon/results/' + safeJobId + '.' + guessExt(buf);
}

async function materializeTryonOutput(job, deps) {
  const info = job || {};
  if (info.status !== 'succeeded' || !info.outputUrl) {
    return Object.assign({}, info, { outputFileID: info.outputFileID || '' });
  }
  const downloadBuffer = (deps && deps.downloadBuffer) || httpBuffer;
  const uploadBuffer = (deps && deps.uploadBuffer) || ((buf, cloudPath) => {
    const cloud = getCloud();
    return cloud.uploadFile({ cloudPath, fileContent: buf });
  });
  const buf = await downloadBuffer(info.outputUrl);
  assertImageSize(buf);
  const cloudPath = resultCloudPath(info.jobId, buf);
  const up = await uploadBuffer(buf, cloudPath);
  if (!up || !up.fileID) throw new Error('云存储未返回 fileID');
  return Object.assign({}, info, { outputFileID: up.fileID });
}

async function callQwenVL(imageUrl, textPrompt) {
  return callQwenVLMulti([imageUrl], textPrompt);
}

async function callQwenVLMulti(imageUrls, textPrompt) {
  const apiKey = getEnv('DASHSCOPE_API_KEY', '');
  if (!apiKey) throw new Error('缺少 DASHSCOPE_API_KEY 环境变量');
  const model = getEnv('QWEN_VL_MODEL', 'qwen-vl-max');
  const content = (imageUrls || []).map((url) => ({
    type: 'image_url',
    image_url: { url }
  }));
  content.push({ type: 'text', text: textPrompt });
  const res = await httpJson('POST', DASH_BASE + '/compatible-mode/v1/chat/completions', {
    Authorization: 'Bearer ' + apiKey
  }, {
    model,
    messages: [{ role: 'user', content }]
  });
  if (res.status >= 400) throw new Error('Qwen-VL 请求失败: ' + (res.raw || '').slice(0, 300));
  const msg = (((res.data || {}).choices || [])[0] || {}).message || {};
  return msg.content || '';
}

const SHAPE_EN = {
  almond: 'almond shaped nail tips',
  square: 'square shaped nail tips',
  round: 'round shaped nail tips',
  trapezoid: 'trapezoid shaped nail tips',
  'short-round': 'short round nail tips',
  tip: 'stiletto pointed nail tips'
};

function shapeEn(shapePrompt) {
  if (!shapePrompt) return 'natural nail tips';
  return SHAPE_EN[shapePrompt] || (shapePrompt + ' shaped nail tips');
}

function buildTryonPrompt(event) {
  const {
    stylePrompt, color, design, shapePrompt, styleTitle,
    hexColors, finish, pattern
  } = event || {};

  const header = [
    'Repaint ONLY the white masked nail plate areas with bold, highly visible salon gel nail polish.',
    'The result must look clearly different from bare natural nails — vivid color and finish are required.',
    'Do NOT modify skin tone, finger shape, knuckles, cuticles, or background.',
    'Photorealistic manicure, sharp nail edges, ' + shapeEn(shapePrompt) + '.'
  ].join(' ');

  if (stylePrompt) {
    let body = stylePrompt;
    if (hexColors && hexColors.length) body += ' Main colors: ' + hexColors.join(', ') + '.';
    if (finish) body += ' Finish: ' + finish + '.';
    if (pattern) body += ' Pattern: ' + pattern + '.';
    return header + ' ' + body;
  }

  const parts = [header];
  if (color) parts.push('Nail polish color: vivid ' + color + '.');
  if (design && design !== '纯色') parts.push('Nail art pattern: ' + design + '.');
  if (styleTitle) parts.push('Reference style: ' + styleTitle + '.');
  parts.push('High-gloss professional gel finish.');
  return parts.join(' ');
}

async function analyzeStyleFromUrl(styleImageUrl) {
  const ask = [
    '你是美甲款式分析器。分析图片中的美甲款式（只看指甲，不看背景）。只输出 JSON，禁止解释。',
    'schema: {"color":"中文色名","design":"中文图案","hexColors":["#RRGGBB"],"finish":"glossy|matte|cat-eye|jelly","pattern":"英文图案描述",',
    '"stylePrompt":"英文，详细描述指甲颜色/渐变/图案/质感，用于图像局部重绘，50词以内","confidence":0-1}'
  ].join('\n');
  const raw = await callQwenVL(styleImageUrl, ask);
  const parsed = extractJson(raw) || {};
  const stylePrompt = parsed.stylePrompt || [
    parsed.color ? 'vivid ' + parsed.color + ' gel polish' : '',
    parsed.pattern || (parsed.design && parsed.design !== '纯色' ? parsed.design + ' nail art' : ''),
    parsed.finish ? parsed.finish + ' finish' : 'high-gloss finish'
  ].filter(Boolean).join(', ');
  return {
    color: parsed.color,
    design: parsed.design,
    hexColors: Array.isArray(parsed.hexColors) ? parsed.hexColors : [],
    finish: parsed.finish || '',
    pattern: parsed.pattern || '',
    stylePrompt,
    confidence: Number(parsed.confidence) || 0.7
  };
}

async function analyzeDualForTryon(styleImageUrl, handImageUrl, shapePrompt) {
  const ask = [
    'Image 1 = target nail style reference photo. Image 2 = user hand photo (will edit nails only).',
    'Study the nail polish in image 1: color, gradient, pattern, finish, decorations.',
    'Output JSON only, no explanation:',
    '{"inpaintPrompt":"English detailed prompt to repaint nails on image2 to match image1 style, 60 words max",',
    '"hexColors":["#RRGGBB"],"finish":"...","pattern":"...","confidence":0-1}',
    'inpaintPrompt must demand visible bold color change on nail plates only.',
    'Preferred nail shape: ' + shapeEn(shapePrompt)
  ].join('\n');
  const raw = await callQwenVLMulti([styleImageUrl, handImageUrl], ask);
  const parsed = extractJson(raw) || {};
  return {
    stylePrompt: parsed.inpaintPrompt || parsed.stylePrompt || '',
    hexColors: Array.isArray(parsed.hexColors) ? parsed.hexColors : [],
    finish: parsed.finish || '',
    pattern: parsed.pattern || '',
    confidence: Number(parsed.confidence) || 0.75
  };
}

async function resolveStyleImageUrl(event) {
  const ev = event || {};
  if (ev.styleFileID) {
    const buf = await getImageBufferFromFileID(ev.styleFileID);
    return imageInputToUrl({ type: 'buffer', value: buf });
  }
  return ev.styleCoverUrl || ev.styleImageUrl || '';
}

function hasCatalogStylePrompt(event) {
  const p = (event && event.stylePrompt) || '';
  return typeof p === 'string' && p.trim().length > 16;
}

async function resolveStylePrompt(event, handImageUrl, styleUrlCached) {
  const styleUrl = styleUrlCached || await resolveStyleImageUrl(event);
  const merged = Object.assign({}, event, {
    styleCoverUrl: styleUrl,
    styleImageUrl: styleUrl
  });

  // 目录款已带英文 prompt：跳过双图/单图 VLM，缩短 submit 耗时（万相仍用 styleUrl + prompt）
  if (!(event && event.styleFileID) && hasCatalogStylePrompt(event)) {
    console.log('[tryon] catalog fast path: skip style VL');
    return merged;
  }

  if (styleUrl && handImageUrl) {
    let dual = null;
    try {
      dual = await analyzeDualForTryon(styleUrl, handImageUrl, event.shapePrompt);
      if (dual.stylePrompt) {
        merged.stylePrompt = dual.stylePrompt;
        merged.hexColors = dual.hexColors;
        merged.finish = dual.finish;
        merged.pattern = dual.pattern;
        console.log('[tryon] dual VL prompt ok, confidence=', dual.confidence);
        if (dual.confidence < 0.65 && event.stylePrompt) {
          merged.stylePrompt += ' ' + event.stylePrompt;
        }
        return merged;
      }
    } catch (e) {
      console.warn('[tryon] dual VL fail', e.message);
    }
    try {
      const style = await analyzeStyleFromUrl(styleUrl);
      if (style.stylePrompt) {
        merged.stylePrompt = style.stylePrompt;
        merged.hexColors = style.hexColors;
        merged.finish = style.finish;
        merged.pattern = style.pattern;
        if (style.color) merged.color = style.color;
        if (style.design) merged.design = style.design;
        console.log('[tryon] style VL prompt ok');
      }
    } catch (e2) {
      console.warn('[tryon] style VL fail', e2.message);
    }
  }
  return merged;
}

function verticalHandFallbackNails() {
  return [
    { cx: 0.27, cy: 0.26, rx: 0.038, ry: 0.052 },
    { cx: 0.39, cy: 0.22, rx: 0.038, ry: 0.052 },
    { cx: 0.52, cy: 0.20, rx: 0.038, ry: 0.052 },
    { cx: 0.65, cy: 0.23, rx: 0.038, ry: 0.052 }
  ];
}

function horizontalHandFallbackNails() {
  return [
    { cx: 0.18, cy: 0.38, rx: 0.038, ry: 0.055 },
    { cx: 0.32, cy: 0.34, rx: 0.038, ry: 0.055 },
    { cx: 0.48, cy: 0.32, rx: 0.038, ry: 0.055 },
    { cx: 0.64, cy: 0.34, rx: 0.038, ry: 0.055 },
    { cx: 0.78, cy: 0.38, rx: 0.038, ry: 0.055 }
  ];
}

function normalizeNails(nails) {
  return (nails || []).map((n) => ({
    cx: Math.min(1, Math.max(0, Number(n.cx) || 0.5)),
    cy: Math.min(1, Math.max(0, Number(n.cy) || 0.5)),
    rx: Math.min(0.12, Math.max(0.018, Number(n.rx) || 0.035)) * MASK_SCALE,
    ry: Math.min(0.14, Math.max(0.022, Number(n.ry) || 0.05)) * MASK_SCALE
  }));
}

/** 万相 2.7 bbox 用更紧的甲面框（mask 路径仍用 MASK_SCALE 放大） */
function nailsForWan27Bbox(nails) {
  return (nails || []).map((n) => ({
    cx: Math.min(1, Math.max(0, Number(n.cx) || 0.5)),
    cy: Math.min(1, Math.max(0, Number(n.cy) || 0.5)),
    rx: Math.min(0.08, Math.max(0.018, (Number(n.rx) || 0.035) / MASK_SCALE)),
    ry: Math.min(0.10, Math.max(0.022, (Number(n.ry) || 0.05) / MASK_SCALE))
  }));
}

async function analyzeNailsOnce(imageUrl, ask) {
  const raw = await callQwenVL(imageUrl, ask);
  const parsed = extractJson(raw) || {};
  let nails = Array.isArray(parsed.nails) ? parsed.nails : [];
  const orientation = (parsed.orientation || '').toLowerCase();
  if (!nails.length && parsed.handDetected !== false) {
    nails = orientation === 'horizontal'
      ? horizontalHandFallbackNails()
      : verticalHandFallbackNails();
  }
  return {
    handDetected: parsed.handDetected !== false,
    nailCount: parsed.nailCount || nails.length,
    nails: normalizeNails(nails),
    orientation,
    confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.7)),
    raw
  };
}

async function analyzeNails(event) {
  const input = await resolveInputImage(event);
  const imageUrl = await imageInputToUrl(input);
  const askZh = [
    '分析手部照片中的每个可见指甲位置。坐标归一化：左上角(0,0)，右下角(1,1)。',
    '只输出 JSON，禁止解释。',
    'schema: {"handDetected":true,"orientation":"vertical|horizontal","nailCount":4,',
    '"nails":[{"cx":0.5,"cy":0.2,"rx":0.035,"ry":0.05}],"confidence":0-1}',
    'cx,cy=指甲中心；rx,ry=椭圆半轴(相对整图宽高)。列出每只可见指甲。'
  ].join('\n');
  let data = await analyzeNailsOnce(imageUrl, askZh);

  if (data.confidence < 0.62 || data.nails.length < 3) {
    const askEn = [
      'Detect every visible fingernail in this hand photo. Normalized coords: top-left (0,0), bottom-right (1,1).',
      'JSON only: {"handDetected":true,"orientation":"vertical|horizontal","nailCount":N,',
      '"nails":[{"cx":0.5,"cy":0.2,"rx":0.035,"ry":0.05}],"confidence":0-1}',
      'cx,cy=nail center; rx,ry=ellipse semi-axes relative to image size.'
    ].join('\n');
    try {
      const retry = await analyzeNailsOnce(imageUrl, askEn);
      if (retry.confidence > data.confidence || retry.nails.length > data.nails.length) {
        data = retry;
        console.log('[tryon] nail VL retry used, confidence=', data.confidence);
      }
    } catch (e) {
      console.warn('[tryon] nail VL retry fail', e.message);
    }
  }

  if (!data.nails.length && data.handDetected) {
    console.warn('[tryon] nail VL empty, fallback vertical');
    data.nails = normalizeNails(verticalHandFallbackNails());
    data.nailCount = data.nails.length;
  }

  return ok(data);
}

async function analyzeStyleReference(event) {
  const styleUrl = (event && (event.imageUrl || event.styleCoverUrl)) || '';
  if (!styleUrl) {
    const input = await resolveInputImage(event);
    const imageUrl = await imageInputToUrl(input);
    const style = await analyzeStyleFromUrl(imageUrl);
    return ok(Object.assign({ shape: '杏仁', style: '温柔' }, style));
  }
  const style = await analyzeStyleFromUrl(styleUrl);
  return ok(Object.assign({
    color: style.color || '裸透粉',
    design: style.design || '纯色',
    shape: '杏仁',
    style: '温柔',
    confidence: style.confidence
  }, style));
}

async function buildMaskBuffer(handBuf, nails) {
  const Jimp = getJimp();
  const handImg = await Jimp.read(handBuf);
  const w = handImg.bitmap.width;
  const h = handImg.bitmap.height;
  const mask = new Jimp(w, h, 0x000000ff);
  let whiteCount = 0;
  (nails || []).forEach((n) => {
    fillEllipse(
      mask,
      (n.cx || 0.5) * w,
      (n.cy || 0.5) * h,
      (n.rx || 0.04) * w,
      (n.ry || 0.06) * h,
      0xffffffff
    );
  });
  mask.scan(0, 0, w, h, function(x, y, idx) {
    if (this.bitmap.data[idx] > 200) whiteCount++;
  });
  if (whiteCount < 50) {
    throw new Error('指甲 Mask 区域过小，请换更清晰的手部正面照');
  }
  mask.blur(3);
  return mask.getBufferAsync(Jimp.MIME_PNG);
}

async function submitTryonJob(event) {
  const input = await resolveInputImage(event);
  const handBuf = input.type === 'buffer' ? input.value : await httpBuffer(input.value);
  const baseUrl = await imageInputToUrl({ type: 'buffer', value: handBuf });
  const styleUrl = await resolveStyleImageUrl(event);

  const promptEvent = await resolveStylePrompt(event, baseUrl, styleUrl);

  const nailAnalysis = await analyzeNails(Object.assign({}, event, {
    fileID: '',
    imageUrl: baseUrl,
    _internalUrl: true
  }));
  if (nailAnalysis.code !== 0 || !nailAnalysis.data.handDetected) {
    return fail('未检测到手部或指甲，请换一张清晰的手部照片');
  }
  if (!nailAnalysis.data.nails || !nailAnalysis.data.nails.length) {
    return fail('未定位到指甲区域，请确保五指清晰、光线均匀');
  }

  const prompt = buildTryonPrompt(promptEvent);
  const nails = nailAnalysis.data.nails;
  let wanResolved;
  try {
    wanResolved = wanBackends.resolveWanModel(event.wanModel);
  } catch (e) {
    return fail(e.message);
  }

  let wanJob;
  if (wanResolved.backend === BACKEND_MASK) {
    const maskBuf = await buildMaskBuffer(handBuf, nails);
    const maskUp = await uploadBufferGetUrl(maskBuf, 'png');
    wanJob = await wanBackends.submitWanJob({
      baseUrl,
      maskUrl: maskUp.url,
      prompt,
      wanModelOverride: event.wanModel,
      model: wanResolved.model,
      backend: wanResolved.backend
    });
  } else {
    const Jimp = getJimp();
    const handImg = await Jimp.read(handBuf);
    wanJob = await wanBackends.submitWanJob({
      baseUrl,
      styleUrl,
      prompt,
      nails: nailsForWan27Bbox(nails),
      imageWidth: handImg.bitmap.width,
      imageHeight: handImg.bitmap.height,
      wanModelOverride: event.wanModel,
      model: wanResolved.model,
      backend: wanResolved.backend
    });
  }

  return ok({
    jobId: wanJob.taskId,
    status: 'processing',
    outputUrl: '',
    provider: 'dashscope-wan',
    wanModel: wanJob.wanModel,
    wanBackend: wanJob.wanBackend,
    nailCount: nails.length,
    usedStyleImage: !!styleUrl
  });
}

function shouldMaterializeOnQuery(event) {
  if (event && event.materialize === true) return true;
  return getEnv('TRYON_MATERIALIZE_ON_QUERY', '') === '1';
}

async function queryTryonJob(event) {
  const { jobId } = event || {};
  if (!jobId) return fail('缺少 jobId');
  const r = await wanBackends.queryWanJob(jobId);
  let status = 'processing';
  if (r.status === 'SUCCEEDED') status = 'succeeded';
  else if (r.status === 'FAILED') status = 'failed';
  let output = {
    jobId,
    status,
    outputUrl: r.outputUrl || '',
    outputFileID: '',
    error: status === 'failed' ? (r.message || '生图失败') : ''
  };
  if (status === 'succeeded' && output.outputUrl && shouldMaterializeOnQuery(event)) {
    try {
      output = await materializeTryonOutput(output);
    } catch (e) {
      throw new Error('成图转存失败: ' + (e && e.message ? e.message : String(e)));
    }
  }
  return ok({
    jobId: output.jobId,
    status: output.status,
    outputUrl: output.outputUrl || '',
    outputFileID: output.outputFileID || '',
    error: output.error || ''
  });
}

async function ping() {
  let deps = { wxServerSdk: false, jimp: false };
  try { require.resolve('wx-server-sdk'); deps.wxServerSdk = true; } catch (e) { /* ignore */ }
  try { require.resolve('jimp'); deps.jimp = true; } catch (e) { /* ignore */ }
  const wanResolved = wanBackends.resolveWanModel();
  return ok({
    ok: true,
    hasDashScopeKey: !!getEnv('DASHSCOPE_API_KEY', ''),
    qwenModel: getEnv('QWEN_VL_MODEL', 'qwen-vl-max'),
    wanModel: wanResolved.model,
    wanBackend: wanResolved.backend,
    supportedModels: wanBackends.SUPPORTED_MODELS,
    tryonStrategy: wanBackends.TRYON_STRATEGY_ID,
    runtime: 'handler-v7-wan27-dual-0531',
    deps
  });
}

function normalizeError(e) {
  if (!e) return '试戴云函数异常';
  const msg = e.message || String(e);
  if (/Cannot find module/i.test(msg)) {
    return '依赖未安装: ' + msg + '。请使用「云端安装依赖」重新部署';
  }
  if (/Insufficient|quota|balance|Arrearage/i.test(msg)) return 'DashScope 余额不足，请充值后重试';
  if (/Throttling|rate|limit/i.test(msg)) return '请求过于频繁，请稍后重试';
  if (/DASHSCOPE_API_KEY/i.test(msg)) return '云函数未配置 DASHSCOPE_API_KEY';
  return msg;
}

async function handle(event) {
  try {
    const action = (event && event.action) || '';
    if (action === 'ping') return await ping();
    requireOpenId();
    if (action === 'analyzeStyleReference') return await analyzeStyleReference(event);
    if (action === 'analyzeNails') return await analyzeNails(event);
    if (action === 'submitTryonJob') return await submitTryonJob(event);
    if (action === 'queryTryonJob') return await queryTryonJob(event);
    return fail('未知 action: ' + action);
  } catch (e) {
    console.error('[tryon] handle error', e);
    return fail(normalizeError(e));
  }
}

module.exports = { handle, materializeTryonOutput };
