// 封闭标签词表 — 与 nailmirror/src/config/tag-vocabulary.js 保持同步
// 来源 docs/美甲标签与标准词表.md

const COLOR_FAMILIES = [
  '红粉色系', '黄绿色系', '蓝紫色系', '黑白灰色系',
  '金属色系', '美拉德色系', '莫兰蒂色系', '多巴胺色系'
]

const DESIGNS = [
  '纯色', '法式', '猫眼', '魔镜粉', '手绘', '镶钻/珍珠', '碎钻', '微雕'
]

const SHAPES = [
  '短方圆', '短椭圆', '中长方', '中长圆', '中长杏仁', '长梯形', '长尖形', '加长杏仁'
]

const STYLES = [
  '日常百搭', '酷飒个性', '甜美少女', '中式典雅', '创意小众'
]

const FIELD_LISTS = { color: COLOR_FAMILIES, design: DESIGNS, shape: SHAPES, style: STYLES }
const FIELD_DEFAULTS = { color: '红粉色系', design: '纯色', shape: '中长杏仁', style: '日常百搭' }

function normalizeTag(field, raw) {
  const list = FIELD_LISTS[field]
  if (!list) return FIELD_DEFAULTS[field] || ''
  const text = (raw || '').trim().replace(/\s+/g, '')
  if (!text) return FIELD_DEFAULTS[field]
  const exact = list.find((item) => item === text || item === (raw || '').trim())
  if (exact) return exact
  let best = null
  for (const item of list) {
    if (text.indexOf(item) > -1 || item.indexOf(text) > -1) {
      if (!best || item.length > best.length) best = item
    }
  }
  if (best) return best
  for (const item of list) {
    const key = item.replace(/\//g, '')
    if (text.indexOf(key) > -1) return item
  }
  return FIELD_DEFAULTS[field]
}

/**
 * 生成 VLM 打标 prompt（封闭词表 + 要求 4 字展示名）
 * name 要求"恰好 4 个汉字、体现颜色/工艺/风格特点、不含标点数字英文"
 */
function buildVlmPrompt() {
  return [
    '你是美甲款式识别器。分析图片，只输出 JSON，禁止任何解释。',
    '必须从下列词表中各选一项（逐字匹配，不得自造词）：',
    'color: ' + COLOR_FAMILIES.join('、'),
    'design: ' + DESIGNS.join('、'),
    'shape: ' + SHAPES.join('、'),
    'style: ' + STYLES.join('、'),
    'name: 恰好4个汉字的中文款式名，体现颜色/工艺/风格特点，不含标点、数字、英文。',
    'schema: {"color":"...","design":"...","shape":"...","style":"...","name":"4字名"}'
  ].join('\n')
}

/** 对 VLM 返回的 name 做后处理，确保恰好 4 个汉字 */
function normalizeVlmName(raw) {
  if (!raw) return ''
  // 只保留汉字
  const hanzi = (raw || '').replace(/[^\u4e00-\u9fa5]/g, '')
  if (hanzi.length === 4) return hanzi
  if (hanzi.length > 4) return hanzi.slice(0, 4)
  // 不足 4 字则原样返回（宁可不强制补），让上层决定是否用 fallback
  return hanzi
}

module.exports = {
  COLOR_FAMILIES, DESIGNS, SHAPES, STYLES,
  normalizeTag, buildVlmPrompt, normalizeVlmName,
}
