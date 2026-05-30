#!/usr/bin/env node
/**
 * 导入 / 重打标真实款式 → mock/styles.real.js
 *
 *   node scripts/import-styles.js                    # 词表轮转默认标签
 *   node scripts/import-styles.js --retag            # 从现有 styles.real.js 读图 URL
 *   DASHSCOPE_API_KEY=sk-xxx node scripts/import-styles.js --vlm --retag
 *
 * 词表：docs/美甲标签与标准词表.md → config/tag-vocabulary.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const OUT = path.join(ROOT, 'mock', 'styles.real.js');

const {
  normalizeTag,
  buildVlmPrompt,
  defaultTags,
  buildDisplayTags
} = require('../config/tag-vocabulary');

function toHttpsUrl(url) {
  if (!url || typeof url !== 'string') return url;
  return url.replace(/^http:\/\//i, 'https://');
}

function loadXlsxRows() {
  const { execSync } = require('child_process');
  const pyScript = path.join(__dirname, 'read_styles_xlsx.py');
  const raw = execSync(`python "${pyScript}" "${DATA_DIR}"`, { encoding: 'utf8' });
  return JSON.parse(raw.trim());
}

function loadRetagRows() {
  const stylesPath = path.join(ROOT, 'mock', 'styles.real.js');
  delete require.cache[require.resolve(stylesPath)];
  const styles = require(stylesPath);
  return styles.map((s, i) => {
    const m = String(s.id || '').match(/real-(\d+)/);
    const idx = m ? parseInt(m[1], 10) : i + 1;
    return {
      idx,
      enhanced: s.coverUrl,
      orig: s.sourceUrl || s.coverUrl,
      prev: s
    };
  });
}

function normalizeVlmTags(raw) {
  return {
    color: normalizeTag('color', raw.color),
    design: normalizeTag('design', raw.design),
    shape: normalizeTag('shape', raw.shape),
    style: normalizeTag('style', raw.style),
    name: (raw.name || '').trim()
  };
}

function loadApiKey() {
  const fromEnv = (process.env.DASHSCOPE_API_KEY || '').trim();
  if (fromEnv) return fromEnv;
  const keyFile = path.join(ROOT, '.local', 'dashscope_api_key');
  if (fs.existsSync(keyFile)) {
    return fs.readFileSync(keyFile, 'utf8').trim();
  }
  return '';
}

async function tagWithVlm(imageUrl, apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  let res;
  try {
    res = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.QWEN_VL_MODEL || 'qwen-vl-max',
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: buildVlmPrompt() }
          ]
        }]
      }),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error?.message || body.message || ('HTTP ' + res.status));
  }
  const text = body.choices?.[0]?.message?.content || '';
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('VLM 未返回 JSON: ' + text.slice(0, 200));
  return normalizeVlmTags(JSON.parse(m[0]));
}

function toNailStyle(row, tags) {
  const {
    mapStyleCn,
    mapShapeCn,
    inferMaterialTags,
    buildStylePrompt
  } = require('../config/label-maps');

  const color = tags.color;
  const design = tags.design;
  const shapeLabel = tags.shape;
  const styleLabel = tags.style;
  const styleTag = mapStyleCn(styleLabel);
  const shapeTag = mapShapeCn(shapeLabel);
  const title = tags.name || (color + '·' + design);
  const idx = row.idx;
  const enhanced = toHttpsUrl(row.enhanced);
  const orig = toHttpsUrl(row.orig);
  const displayTags = buildDisplayTags(color, design, shapeLabel, styleLabel);
  const prev = row.prev || {};

  return {
    id: 'real-' + idx,
    title,
    coverUrl: enhanced,
    sourceUrl: orig,
    previewUrls: [enhanced, orig].filter(Boolean),
    color,
    design,
    styleLabel,
    shapeLabel,
    displayTags,
    styleTags: [styleTag],
    materialTags: inferMaterialTags(color, design),
    shapeTags: [shapeTag],
    heat: prev.heat != null ? prev.heat : Math.round((1 + (25 - idx) * 0.04) * 1000),
    rankWeight: prev.rankWeight != null ? prev.rankWeight : 1 + (25 - idx) * 0.04,
    isActive: prev.isActive !== false,
    merchantId: prev.merchantId != null ? prev.merchantId : null,
    brief: [color, design, shapeLabel, styleLabel].filter(Boolean).join('·'),
    stylePrompt: buildStylePrompt(color, design, styleLabel),
    createdAt: prev.createdAt || '2026-05-24'
  };
}

async function main() {
  const useVlm = process.argv.includes('--vlm');
  const retag = process.argv.includes('--retag');
  const apiKey = loadApiKey();

  if (useVlm && !apiKey) {
    console.error('需要 DASHSCOPE_API_KEY 环境变量或 .local/dashscope_api_key 文件');
    process.exit(1);
  }

  let rows;
  if (retag) {
    rows = loadRetagRows();
    console.log('--retag：从 styles.real.js 读取', rows.length, '条');
  } else {
    rows = loadXlsxRows();
    console.log('从 xlsx 读取', rows.length, '条');
  }

  const failed = [];
  const items = [];

  for (const row of rows) {
    let tags;
    if (useVlm) {
      try {
        tags = await tagWithVlm(toHttpsUrl(row.enhanced), apiKey);
        console.log('VLM', row.idx, tags.color, tags.design, tags.shape, tags.style);
        await new Promise((r) => setTimeout(r, 500));
      } catch (e) {
        console.warn('VLM 失败', row.idx, e.message, '→ 词表默认');
        failed.push(row.idx);
        tags = normalizeVlmTags(defaultTags(row.idx));
      }
    } else {
      tags = normalizeVlmTags(defaultTags(row.idx));
    }
    items.push(toNailStyle(row, tags));
  }

  items.sort((a, b) => {
    const ai = parseInt(String(a.id).replace('real-', ''), 10);
    const bi = parseInt(String(b.id).replace('real-', ''), 10);
    return ai - bi;
  });

  const content = '// AUTO-GENERATED by scripts/import-styles.js — DO NOT EDIT BY HAND\nmodule.exports = ' + JSON.stringify(items, null, 2) + ';\n';
  fs.writeFileSync(OUT, content, 'utf8');
  console.log('已写入', OUT, '(', items.length, '条)');
  if (failed.length) console.warn('需人工复核 idx:', failed.join(', '));
}

main().catch((e) => { console.error(e); process.exit(1); });
