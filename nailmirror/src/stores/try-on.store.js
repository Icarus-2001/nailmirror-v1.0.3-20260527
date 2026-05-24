// tryOnStore — 当前甲型 / 款式 / 试戴上下文
const { observable, action } = require('mobx-miniprogram');

const tryOnStore = observable({
  currentShape: 'almond',
  currentStyleId: '',
  mode: 'ar',         // ar | static | ai-match
  manualMode: null,   // 用户手动选择 AR/Static

  setShape: action(function (shape) { this.currentShape = shape; }),
  setStyle: action(function (id) { this.currentStyleId = id; }),
  setMode: action(function (mode) { this.mode = mode; }),
  setManualMode: action(function (mode) { this.manualMode = mode; })
});

module.exports = { tryOnStore };
