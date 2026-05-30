// 封闭标签词表 — 来源 docs/美甲标签与标准词表.md

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
  defaultTags,
  buildDisplayTags
};
