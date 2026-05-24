// 内置测试手照（跳过相册/相机，用于验证云试戴生图链路）
const evalHands = require('../mock/eval-hands');

module.exports = {
  LOCAL: {
    id: 'local',
    label: '本地手型',
    bundlePath: '/data/hand-mock.jpg',
    displayPath: '/data/手型.jpg'
  },
  evalHands,
  DEFAULT_EVAL_ID: 'eval-1',
  /** @deprecated 兼容旧引用 */
  BUNDLE_PATH: '/data/hand-mock.jpg',
  DISPLAY_PATH: '/data/手型.jpg'
};
