// 备货建议已于 1.2.4 下线；保留路由桩避免旧版 app.json 缓存编译 ENOENT
Page({
  onLoad() {
    wx.redirectTo({
      url: '/pages-b/dashboard/index',
      fail: () => {
        wx.navigateBack({
          fail: () => wx.switchTab({ url: '/pages/home/index' })
        });
      }
    });
  }
});
