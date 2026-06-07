// 业务枚举：甲型 / 风格 / 材质
const NAIL_SHAPES = [
  // 短款
  { id: 'short-square-round', label: '短方圆',   desc: '干净利落，百搭日常' },
  { id: 'short-oval',         label: '短椭圆',   desc: '小巧温柔，上班首选' },
  // 中长款
  { id: 'mid-square',         label: '中长方',   desc: '修长干练，利落有型' },
  { id: 'mid-round',          label: '中长圆',   desc: '温柔大方，通勤必备' },
  { id: 'mid-almond',         label: '中长杏仁', desc: '显手纤细，优雅精致' },
  // 加长款
  { id: 'long-trapezoid',     label: '长梯形',   desc: '复古个性，个性表达' },
  { id: 'long-tip',           label: '长尖形',   desc: '锋利前卫，舞台感十足' },
  { id: 'long-almond',        label: '加长杏仁', desc: '奢华精致，引人注目' }
];

const NAIL_SHAPE_GROUPS = [
  { groupLabel: '短款',   ids: ['short-square-round', 'short-oval'] },
  { groupLabel: '中长款', ids: ['mid-square', 'mid-round', 'mid-almond'] },
  { groupLabel: '长款',   ids: ['long-trapezoid', 'long-tip', 'long-almond'] }
];

const NAIL_STYLES = [
  { id: 'cool',     label: '冷酷' },
  { id: 'gentle',   label: '温柔' },
  { id: 'french',   label: '法式' },
  { id: 'cream',    label: '奶油' },
  { id: 'glitter',  label: '亮闪' },
  { id: 'vintage',  label: '复古' },
  { id: 'fairy',    label: '甜美' },
  { id: 'minimal',  label: '极简' }
];

const NAIL_MATERIALS = [
  { id: 'cat-eye',   label: '猫眼' },
  { id: 'glitter',   label: '亮片' },
  { id: 'matte',     label: '磨砂' },
  { id: 'jelly',     label: '果冻' },
  { id: 'mirror',    label: '镜面' },
  { id: 'pearl',     label: '珠光' }
];

const TRY_ON_MODES = {
  AR: 'ar',
  STATIC: 'static',
  AI_MATCH: 'ai-match'
};

const DEVICE_LEVELS = { HIGH: 'high', MID: 'mid', LOW: 'low' };

// 标准词表（与 tag-vocabulary 同源，经 enums 导出供组件 require）
const {
  COLOR_FAMILIES,
  DESIGNS,
  SHAPES: NAIL_SHAPE_LABELS,
  STYLES: NAIL_STYLE_LABELS
} = require('./tag-vocabulary');

module.exports = {
  NAIL_SHAPES,
  NAIL_SHAPE_GROUPS,
  NAIL_STYLES,
  NAIL_MATERIALS,
  TRY_ON_MODES,
  DEVICE_LEVELS,
  COLOR_FAMILIES,
  DESIGNS,
  NAIL_SHAPE_LABELS,
  NAIL_STYLE_LABELS
};
