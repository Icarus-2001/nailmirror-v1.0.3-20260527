const { NAIL_SHAPES } = require('../../config/enums');
const { tryOnStore } = require('../../stores/try-on.store');

Page({
  data: {
    shapes: NAIL_SHAPES,
    selected: ''
  },
  onLoad() {
    this.setData({ selected: tryOnStore.currentShape });
  },
  onPick(e) {
    const v = e.currentTarget.dataset.v;
    this.setData({ selected: v });
    tryOnStore.setShape(v);
  },
  onNext() {
    if (!this.data.selected) { wx.showToast({ title: '请选择甲型', icon: 'none' }); return; }
    wx.navigateTo({ url: '/pages/style-library/index' });
  }
});
