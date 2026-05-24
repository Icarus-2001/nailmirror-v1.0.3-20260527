const historyService = require('../../services/history.service');

Page({
  data: {
    list: []
  },
  async onShow() {
    const list = await historyService.list();
    this.setData({ list });
  },
  async onRegenerate(e) {
    const id = e.currentTarget.dataset.id;
    wx.showLoading({ title: '重新出图…' });
    try {
      const r = await historyService.reGenerate(id);
      wx.hideLoading();
      const target = this.data.list.find((x) => x.id === id);
      if (target) wx.navigateTo({ url: '/pages/hd-output/index?styleId=' + target.styleId + '&hdUrl=' + encodeURIComponent(r.hdUrl) });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '出图失败', icon: 'none' });
    }
  },
  async onRemove(e) {
    const id = e.currentTarget.dataset.id;
    const res = await wx.showModal({ title: '删除', content: '确定删除这条试戴历史？' });
    if (res.confirm) {
      await historyService.remove(id);
      this.setData({ list: this.data.list.filter((x) => x.id !== id) });
      wx.showToast({ title: '已删除' });
    }
  }
});
