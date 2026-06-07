const favoriteService = require('../../services/favorite.service');

Page({
  data: {
    list: [],
    selected: {},
    selectMode: false,
    loading: false
  },
  async onShow() {
    // 1. 先用本地缓存快速展示
    const quickList = await favoriteService.list({ skipRefresh: true });
    this.setData({ list: quickList, loading: quickList.length === 0 });

    // 2. 后台拉云端收藏 + 刷新款式目录（含商家图 cloud://）
    try {
      await favoriteService.mergeFromCloud();
      const list = await favoriteService.list();
      this.setData({ list, selectMode: false, selected: {}, loading: false });
    } catch (e) {
      this.setData({ loading: false });
    }
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
