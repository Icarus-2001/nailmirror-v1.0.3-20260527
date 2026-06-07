// 封闭标签词表 — 与 nailmirror/src/config/tag-vocabulary.js 保持同步
// 来源 docs/美甲标签与标准词表.md

const COLOR_FAMILIES = [
  '红粉色系', '黄绿色系', '蓝紫色系', '黑白灰色系',
  '金属色系', '美拉德色系', '莫兰蒂色系', '多巴胺色系'
];

const DESIGNS = [
  '纯色', '法式', '猫眼', '魔镜粉', '手绘', '镶钻/珍珠', '碎钻', '微雕'
];

const SHAPES = [
  '短方圆', '短椭圆', '中长方', '中长圆', '中长杏仁', '长梯形', '长尖形', '加长杏仁'
];

const STYLES = [
  '日常百搭', '酷飒个性', '甜美少女', '中式典雅', '创意小众'
];

const FIELD_LISTS = {
  color: COLOR_FAMILIES,
  design: DESIGNS,
  shape: SHAPES,
  style: STYLES
};

const FIELD_DEFAULTS = {
  color: '红粉色系',
  design: '纯色',
  shape: '中长杏仁',
  style: '日常百搭'
};

/** 子串匹配：优先最长命中 */
function normalizeTag(field, raw) {
  const list = FIELD_LISTS[field];
  if (!list) return FIELD_DEFAULTS[field] || '';
  const text = (raw || '').trim().replace(/\s+/g, '');
  if (!text) return FIELD_DEFAULTS[field];

  const exact = list.find((item) => item === text || item === raw.trim());
  if (exact) return exact;

  let best = null;
  for (const item of list) {
    if (text.indexOf(item) > -1 || item.indexOf(text) > -1) {
      if (!best || item.length > best.length) best = item;
    }
  }
  if (best) return best;

  for (const item of list) {
    const key = item.replace(/\//g, '');
    if (text.indexOf(key) > -1) return item;
  }

  return FIELD_DEFAULTS[field];
}

function buildVlmPrompt() {
  return [
    '你是美甲款式识别器。分析图片，只输出 JSON，禁止任何解释。',
    '必须从下列词表中各选一项（逐字匹配，不得自造词）：',
    'color: ' + COLOR_FAMILIES.join('、'),
    'design: ' + DESIGNS.join('、'),
    'shape: ' + SHAPES.join('、'),
    'style: ' + STYLES.join('、'),
    'schema: {"color":"...","design":"...","shape":"...","style":"...","name":"10字内展示名"}'
  ].join('\n');
}

function buildAnalyzeNailStylePrompt() {
  return [
    '你是美甲款式识别与审核器。先判断图片是否为「美甲款式参考图」（手指/甲片上的美甲设计特写或沙龙作品）。',
    '非美甲内容（风景、人脸自拍、宠物、食物、文字截图等）只输出：',
    '{"isNailArt":false,"confidence":0.0-1.0,"reason":"10字内"}',
    '若是美甲款式图，必须从下列词表各选一项（逐字匹配，不得自造词）并输出：',
    '{"isNailArt":true,"confidence":0.0-1.0,"color":"...","design":"...","shape":"...","style":"...","name":"10字内展示名"}',
    'color: ' + COLOR_FAMILIES.join('、'),
    'design: ' + DESIGNS.join('、'),
    'shape: ' + SHAPES.join('、'),
    'style: ' + STYLES.join('、'),
    '禁止任何解释，只输出 JSON。'
  ].join('\n');
}

function defaultTags(idx) {
  const i = idx - 1;
  return {
    color: COLOR_FAMILIES[i % COLOR_FAMILIES.length],
    design: DESIGNS[i % DESIGNS.length],
    shape: SHAPES[i % SHAPES.length],
    style: STYLES[i % STYLES.length],
    name: ''
  };
}

function buildDisplayTags(color, design, shapeLabel, styleLabel) {
  return [color, design, shapeLabel, styleLabel].filter(Boolean);
}

module.exports = {
  COLOR_FAMILIES,
  DESIGNS,
  SHAPES,
  STYLES,
  normalizeTag,
  buildVlmPrompt,
  buildAnalyzeNailStylePrompt,
  defaultTags,
  buildDisplayTags
};
