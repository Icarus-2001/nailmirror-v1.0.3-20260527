Page({
  data: {
    styleId: '',
  },

  onLoad(query) {
    this.setData({ styleId: (query && query.id) || '' });
  },

  onBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
      return;
    }
    wx.switchTab({ url: '/pages/home/index' });
  },

  onGoHome() {
    wx.switchTab({ url: '/pages/home/index' });
  },
});
