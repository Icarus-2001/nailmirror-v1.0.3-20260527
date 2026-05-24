// 中文标签 ↔ enums id 映射（VLM 打标 / 筛选共用）

const STYLE_CN_TO_ID = {
  '冷酷': 'cool', '甜酷': 'cool', '甜酷少女': 'cool',
  '温柔': 'gentle', '甜美': 'fairy', '少女': 'fairy',
  '法式': 'french', '奶油': 'cream', '奶茶': 'cream',
  '亮闪': 'glitter', '亮片': 'glitter', '闪片': 'glitter',
  '复古': 'vintage', '极简': 'minimal', '简约': 'minimal',
  '猫眼': 'cool', '果冻': 'gentle', '纯色': 'minimal'
};

const SHAPE_CN_TO_ID = {
  '杏仁': 'almond', '杏仁形': 'almond',
  '方形': 'square', '方': 'square',
  '圆形': 'round', '圆': 'round',
  '梯形': 'trapezoid',
  '短圆': 'short-round', '短圆形': 'short-round',
  '贴片': 'tip', '贴片形': 'tip', '延长': 'tip'
};

const COLOR_TO_MATERIAL = {
  '猫眼': 'cat-eye', '镜面': 'mirror', '珠光': 'pearl',
  '磨砂': 'matte', '亮片': 'glitter', '果冻': 'jelly'
};

const STYLE_ID_TO_LABEL = {
  cool: '冷酷', gentle: '温柔', french: '法式', cream: '奶油',
  glitter: '亮闪', vintage: '复古', fairy: '甜美', minimal: '极简'
};

const SHAPE_ID_TO_LABEL = {
  almond: '杏仁形', square: '方形', round: '圆形',
  trapezoid: '梯形', 'short-round': '短圆形', tip: '贴片形'
};

function mapStyleCn(cn) {
  if (!cn) return 'minimal';
  for (const key of Object.keys(STYLE_CN_TO_ID)) {
    if (cn.indexOf(key) > -1) return STYLE_CN_TO_ID[key];
  }
  return 'minimal';
}

function mapShapeCn(cn) {
  if (!cn) return 'almond';
  for (const key of Object.keys(SHAPE_CN_TO_ID)) {
    if (cn.indexOf(key) > -1) return SHAPE_CN_TO_ID[key];
  }
  return 'almond';
}

function inferMaterialTags(color, design) {
  const tags = [];
  const text = (color || '') + (design || '');
  Object.keys(COLOR_TO_MATERIAL).forEach((k) => {
    if (text.indexOf(k) > -1) tags.push(COLOR_TO_MATERIAL[k]);
  });
  if (!tags.length) tags.push('jelly');
  return tags;
}

function buildStylePrompt(color, design, styleLabel) {
  const parts = [];
  if (color) parts.push('solid ' + color + ' color');
  if (design && design !== '纯色') parts.push(design + ' nail art pattern');
  if (styleLabel) parts.push(styleLabel + ' style');
  parts.push('gel nail polish, natural finish');
  return parts.join(', ');
}

module.exports = {
  STYLE_CN_TO_ID, SHAPE_CN_TO_ID, COLOR_TO_MATERIAL,
  STYLE_ID_TO_LABEL, SHAPE_ID_TO_LABEL,
  mapStyleCn, mapShapeCn, inferMaterialTags, buildStylePrompt
};
