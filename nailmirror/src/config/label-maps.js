// 中文标签 ↔ enums id 映射（VLM 打标 / 筛选 / 试戴共用）

const STYLE_CN_TO_ID = {
  '日常百搭': 'daily',
  '酷飒个性': 'cool', '冷酷': 'cool', '甜酷': 'cool', '甜酷少女': 'cool',
  '甜美少女': 'fairy', '甜美': 'fairy', '少女': 'fairy',
  '中式典雅': 'chinese',
  '创意小众': 'creative',
  '温柔': 'gentle',
  '法式': 'french',
  '奶油': 'cream', '奶茶': 'cream',
  '亮闪': 'glitter', '亮片': 'glitter', '闪片': 'glitter',
  '复古': 'vintage',
  '极简': 'minimal', '简约': 'minimal',
  '猫眼': 'cool',
  '果冻': 'gentle',
  '纯色': 'minimal'
};

const SHAPE_CN_TO_ID = {
  // 新 id
  '短方圆': 'short-square-round',
  '短椭圆': 'short-oval',
  '中长方': 'mid-square',
  '中长圆': 'mid-round',
  '中长杏仁': 'mid-almond',
  '长梯形': 'long-trapezoid',
  '长尖形': 'long-tip',
  '加长杏仁': 'long-almond',
  // 旧中文标签兼容（映射到最近似新 id）
  '杏仁': 'mid-almond', '杏仁形': 'mid-almond',
  '方形': 'mid-square', '方': 'mid-square',
  '圆形': 'mid-round', '圆': 'mid-round',
  '梯形': 'long-trapezoid',
  '短圆': 'short-square-round', '短圆形': 'short-square-round',
  '贴片': 'long-tip', '贴片形': 'long-tip', '延长': 'long-tip'
};

const DESIGN_TO_MATERIAL = {
  '猫眼': 'cat-eye',
  '魔镜粉': 'mirror',
  '碎钻': 'glitter',
  '镶钻/珍珠': 'pearl',
  '微雕': 'pearl',
  '手绘': 'pearl',
  '镜面': 'mirror',
  '珠光': 'pearl',
  '磨砂': 'matte',
  '亮片': 'glitter',
  '果冻': 'jelly'
};

const STYLE_ID_TO_LABEL = {
  daily: '日常百搭',
  cool: '酷飒个性',
  fairy: '甜美少女',
  chinese: '中式典雅',
  creative: '创意小众',
  gentle: '温柔',
  french: '法式',
  cream: '奶油',
  glitter: '亮闪',
  vintage: '复古',
  minimal: '极简'
};

const SHAPE_ID_TO_LABEL = {
  // 新 id
  'short-square-round': '短方圆',
  'short-oval':         '短椭圆',
  'mid-square':         '中长方',
  'mid-round':          '中长圆',
  'mid-almond':         '中长杏仁',
  'long-trapezoid':     '长梯形',
  'long-tip':           '长尖形',
  'long-almond':        '加长杏仁',
  // 旧 id 兼容（降级到最近似新中文标签）
  almond:       '中长杏仁',
  square:       '中长方',
  round:        '中长圆',
  trapezoid:    '长梯形',
  'short-round':'短方圆',
  tip:          '长尖形'
};

function mapStyleCn(cn) {
  if (!cn) return 'daily';
  for (const key of Object.keys(STYLE_CN_TO_ID)) {
    if (cn.indexOf(key) > -1) return STYLE_CN_TO_ID[key];
  }
  return 'daily';
}

function mapShapeCn(cn) {
  if (!cn) return 'mid-almond';
  const keys = Object.keys(SHAPE_CN_TO_ID).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (cn.indexOf(key) > -1) return SHAPE_CN_TO_ID[key];
  }
  return 'mid-almond';
}

function inferMaterialTags(color, design) {
  const tags = [];
  const text = (color || '') + (design || '');
  Object.keys(DESIGN_TO_MATERIAL).forEach((k) => {
    if (text.indexOf(k) > -1) tags.push(DESIGN_TO_MATERIAL[k]);
  });
  if (!tags.length) tags.push('jelly');
  return [...new Set(tags)];
}

/** 试戴兜底英文 prompt（具体色名，不用 8 大色系） */
function buildTryonStylePrompt(color, design, styleLabel) {
  const parts = [];
  if (color) parts.push('solid ' + color + ' color');
  if (design && design !== '纯色') parts.push(design + ' nail art pattern');
  if (styleLabel) parts.push(styleLabel + ' style');
  parts.push('gel nail polish, natural finish');
  return parts.join(', ');
}

/** @deprecated 请用 config/tryon-prompt.buildTryonEnglishPrompt */
function buildStylePrompt(color, design, styleLabel) {
  const { buildTryonEnglishPrompt } = require('./tryon-prompt');
  return buildTryonEnglishPrompt({ color, design, styleLabel, title: '' });
}

module.exports = {
  STYLE_CN_TO_ID,
  SHAPE_CN_TO_ID,
  DESIGN_TO_MATERIAL,
  STYLE_ID_TO_LABEL,
  SHAPE_ID_TO_LABEL,
  mapStyleCn,
  mapShapeCn,
  inferMaterialTags,
  buildTryonStylePrompt,
  buildStylePrompt
};
