// 业务枚举：甲型 / 风格 / 材质
const NAIL_SHAPES = [
  { id: 'almond',      label: '杏仁形', desc: '优雅显手白，适合细长指' },
  { id: 'square',      label: '方形',   desc: '利落干练，指甲修长款首选' },
  { id: 'round',       label: '圆形',   desc: '温柔百搭，日常通勤' },
  { id: 'trapezoid',   label: '梯形',   desc: '复古独特，个性表达' },
  { id: 'short-round', label: '短圆形', desc: '短款自然，上班族友好' },
  { id: 'tip',         label: '贴片形', desc: '延长指型，适合舞台感' }
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

module.exports = { NAIL_SHAPES, NAIL_STYLES, NAIL_MATERIALS, TRY_ON_MODES, DEVICE_LEVELS };
