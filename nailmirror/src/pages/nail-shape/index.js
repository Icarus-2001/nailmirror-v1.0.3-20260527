const { NAIL_SHAPES, NAIL_SHAPE_GROUPS } = require('../../config/enums');
const { tryOnStore } = require('../../stores/try-on.store');

function buildGroups() {
  const map = {};
  NAIL_SHAPES.forEach(s => { map[s.id] = s; });
  return NAIL_SHAPE_GROUPS.map(g => ({
    groupLabel: g.groupLabel,
    shapes: g.ids.map(id => map[id]).filter(Boolean)
  }));
}

Page({
  data: {
    shapeGroups: buildGroups(),
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
