const { userStore } = require('../../stores/user.store');

Page({
  data: {
    role: 'c'
  },
  onShow() {
    userStore.init();
    this.setData({ role: userStore.role || 'c' });
  },
  onSwitchToB() {
    wx.navigateTo({ url: '/pages-b/merchant-verify/index' });
  },
  onSwitchToC() {
    userStore.setRole('c');
    this.setData({ role: 'c' });
  },
  onGoDashboard() { wx.navigateTo({ url: '/pages-b/dashboard/index' }); },
  onGoStyleUpload() { wx.navigateTo({ url: '/pages-b/style-upload/index' }); },
  onGoStock() { wx.navigateTo({ url: '/pages-b/stock-advice/index' }); },
  onGoContact() { wx.navigateTo({ url: '/pages-b/contact-config/index' }); },
  onGoHotRank() { wx.navigateTo({ url: '/pages-b/hot-rank/index' }); },
  onGoMembership() { wx.navigateTo({ url: '/pages-b/membership/index' }); }
});
