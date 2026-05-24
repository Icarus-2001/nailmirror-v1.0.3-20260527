const favoriteService = require('../../services/favorite.service');
const { favoriteStore } = require('../../stores/favorite.store');

Page({
  data: {
    list: [],
    selected: {},
    selectMode: false
  },
  async onShow() {
    const list = await favoriteService.list();
    this.setData({ list, selectMode: false, selected: {} });
  },
  onToggleSelect() {
    this.setData({ selectMode: !this.data.selectMode, selected: {} });
  },
  onPick(e) {
    if (!this.data.selectMode) {
      const id = e.currentTarget.dataset.id;
      wx.navigateTo({ url: '/pages/style-detail/index?id=' + id });
      return;
    }
    const id = e.currentTarget.dataset.id;
    const sel = Object.assign({}, this.data.selected);
    sel[id] = !sel[id];
    this.setData({ selected: sel });
  },
  async onBatchDelete() {
    const ids = Object.keys(this.data.selected).filter((k) => this.data.selected[k]);
    if (!ids.length) { wx.showToast({ title: '未选择', icon: 'none' }); return; }
    for (const id of ids) await favoriteService.remove(id);
    const list = await favoriteService.list();
    this.setData({ list, selected: {}, selectMode: false });
    wx.showToast({ title: '已删除' });
  }
});
