Page({
  onLoad() {
    wx.redirectTo({
      url: '/pages/hot-rank/index',
      fail: () => {
        wx.navigateTo({ url: '/pages/hot-rank/index' });
      }
    });
  }
});
