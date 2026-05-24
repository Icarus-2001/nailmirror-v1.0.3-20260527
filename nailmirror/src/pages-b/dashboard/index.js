const hotDataService = require('../../services/hot-data.service');

Page({
  data: {
    keywords: [],
    ranking: [],
    updatedAt: '',
    city: '北京'
  },
  async onLoad() {
    try {
      const [kws, rank] = await Promise.all([
        hotDataService.fetchTop20(),
        hotDataService.fetchRanking(this.data.city)
      ]);
      this.setData({
        keywords: kws,
        ranking: rank.items.slice(0, 10),
        updatedAt: rank.updatedAt
      });
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },
  onGoStock() { wx.navigateTo({ url: '/pages-b/stock-advice/index' }); },
  onGoTrend(e) {
    const word = e.currentTarget.dataset.word;
    wx.navigateTo({ url: '/pages-b/hot-rank/index?word=' + encodeURIComponent(word) });
  }
});
