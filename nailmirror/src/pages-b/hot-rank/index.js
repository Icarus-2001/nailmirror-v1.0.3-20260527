// B 端热度榜已于 1.2.4 下线；保留磁盘桩避免旧缓存 ENOENT，勿重新注册到 app.json
Page({
  onLoad() {
    wx.redirectTo({
      url: '/pages/hot-rank/index',
      fail: () => {
        wx.navigateBack({
          fail: () => wx.switchTab({ url: '/pages/home/index' })
        });
      }
    });
  }
});
