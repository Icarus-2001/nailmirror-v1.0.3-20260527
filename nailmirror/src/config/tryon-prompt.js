// 试戴英文 prompt：由 styles.real 上的 VLM 标准标签生成（与列表展示同源）

const { mapShapeCn } = require('./label-maps');

const COLOR_EN = {
  '红粉色系': 'vivid rose, coral pink and cherry red gel polish',
  '黄绿色系': 'fresh lime, chartreuse and olive green gel polish',
  '蓝紫色系': 'periwinkle blue, lavender and soft purple gel polish',
  '黑白灰色系': 'high-contrast black, pure white and soft grey gel polish',
  '金属色系': 'metallic chrome, mirror silver and gold shimmer gel',
  '美拉德色系': 'warm caramel, mocha brown and toasted amber gel',
  '莫兰蒂色系': 'muted dusty rose, sage mauve and grey-pink gel',
  '多巴胺色系': 'bold saturated candy-bright multicolor gel'
};

const DESIGN_EN = {
  '纯色': 'solid uniform color on all nails',
  '法式': 'classic French manicure with crisp white tips and sheer pink base',
  '猫眼': 'cat-eye magnetic gel with a bright reflective band',
  '魔镜粉': 'mirror chrome powder with reflective metallic finish',
  '手绘': 'hand-painted nail art with clear illustrated details',
  '镶钻/珍珠': 'rhinestone crystals and pearl embellishments',
  '碎钻': 'dense micro-glitter sparkle across the nail',
  '微雕': '3D micro-sculpted raised nail art details'
};

const STYLE_EN = {
  '日常百搭': 'everyday salon-ready look',
  '酷飒个性': 'edgy bold statement look',
  '甜美少女': 'sweet soft feminine look',
  '中式典雅': 'elegant refined Chinese-inspired look',
  '创意小众': 'creative artistic niche look'
};

/** 展示名中的图案关键词 → 英文补充（提高「奶牛斑点」等具象款命中率） */
const TITLE_PATTERN_EN = [
  { re: /奶牛|牛斑|黑白斑/, en: 'black and white cow print spots on milky white base' },
  { re: /豹纹|猎豹/, en: 'animal leopard print pattern' },
  { re: /大理石|晕染/, en: 'marble swirl gradient blend' },
  { re: /渐变|ombre/i, en: 'smooth color gradient ombre' },
  { re: /猫眼/, en: 'cat-eye magnetic light band' },
  { re: /法式/, en: 'French tip manicure' },
  { re: /碎钻|闪片|亮片/, en: 'glitter sparkle accents' },
  { re: /镶钻|钻石|珍珠/, en: 'crystal rhinestone and pearl decor' },
  { re: /手绘|彩绘/, en: 'hand-painted illustration' },
  { re: /纯色|裸色|裸粉|奶茶/, en: 'clean sheer nude tone' }
];

function titlePatternHint(title) {
  const t = title || '';
  for (let i = 0; i < TITLE_PATTERN_EN.length; i++) {
    if (TITLE_PATTERN_EN[i].re.test(t)) return TITLE_PATTERN_EN[i].en;
  }
  return '';
}

function colorToEn(color) {
  return COLOR_EN[color] || ('vivid ' + color + ' gel nail polish');
}

function designToEn(design) {
  if (!design || design === '纯色') return DESIGN_EN['纯色'];
  return DESIGN_EN[design] || (design + ' nail art technique');
}

function styleToEn(styleLabel) {
  return STYLE_EN[styleLabel] || (styleLabel + ' aesthetic');
}

/**
 * 生成万相 / 双图 VL 兜底用的英文 stylePrompt
 */
function buildTryonEnglishPrompt(opts) {
  const color = opts.color || '';
  const design = opts.design || '纯色';
  const styleLabel = opts.styleLabel || '';
  const title = opts.title || '';

  const parts = [
    'Professional salon gel manicure, photorealistic, sharp nail edges, high-gloss finish.',
    colorToEn(color) + '.',
    designToEn(design) + '.'
  ];
  if (styleLabel) parts.push(styleToEn(styleLabel) + '.');
  const hint = titlePatternHint(title);
  if (hint) parts.push(hint + '.');
  if (title && !hint) parts.push('Reference style name: ' + title + '.');
  parts.push('Match the reference style image colors and pattern exactly on nail plates only.');
  return parts.join(' ');
}

/** 云函数 event 字段：color/design 用英文短语，便于 buildTryonPrompt 兜底 */
function buildTryonCloudFields(styleMeta, shapeIdOverride) {
  const color = styleMeta.color || '';
  const design = styleMeta.design || '纯色';
  const styleLabel = styleMeta.styleLabel || '';
  const shapeLabel = styleMeta.shapeLabel || '';
  const shapePrompt = shapeIdOverride
    || mapShapeCn(shapeLabel)
    || (styleMeta.shapeTags && styleMeta.shapeTags[0])
    || 'almond';

  const stylePrompt = buildTryonEnglishPrompt({
    color,
    design,
    styleLabel,
    title: styleMeta.title
  });

  const colorLine = colorToEn(color).replace(/\.$/, '');
  const designLine = design === '纯色'
    ? 'solid color'
    : (DESIGN_EN[design] || design).split(',')[0];

  return {
    styleTitle: styleMeta.title || '',
    stylePrompt,
    color: colorLine,
    design: designLine,
    shapePrompt
  };
}

module.exports = {
  COLOR_EN,
  DESIGN_EN,
  STYLE_EN,
  buildTryonEnglishPrompt,
  buildTryonCloudFields,
  titlePatternHint
};
