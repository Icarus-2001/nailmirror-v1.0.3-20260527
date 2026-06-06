const hotDataService = require('../../services/hot-data.service');

Page({
  data: {
    items: [],
    updatedAt: ''
  },
  async onLoad() {
    try {
      const rank = await hotDataService.fetchRanking();
      this.setData({
        items: rank.items,
        updatedAt: rank.updatedAt
      });
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  }
});
