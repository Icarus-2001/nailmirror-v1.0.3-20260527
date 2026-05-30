const hotDataService = require('../../services/hot-data.service');

Page({
  data: {
    items: [],
    updatedAt: '',
    keywords: []
  },
  async onLoad() {
    try {
      const [rank, kws] = await Promise.all([
        hotDataService.fetchRanking(),
        hotDataService.fetchTop20()
      ]);
      this.setData({
        items: rank.items,
        updatedAt: rank.updatedAt,
        keywords: kws.slice(0, 10)
      });
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },
  onItemTap(e) {
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: '/pages/style-detail/index?id=' + id });
  },
  onKeywordTap(e) {
    const word = (e.detail && e.detail.word) || '';
    if (word) {
      wx.navigateTo({ url: '/pages/style-library/index?keyword=' + encodeURIComponent(word) });
    }
  }
});
