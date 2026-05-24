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
    userStore.setRole('b');
    this.setData({ role: 'b' });
    wx.showToast({ title: '已切换到商家身份' });
  },
  onSwitchToC() {
    userStore.setRole('c');
    this.setData({ role: 'c' });
  },
  onGoDashboard() { wx.navigateTo({ url: '/pages-b/dashboard/index' }); },
  onGoStock() { wx.navigateTo({ url: '/pages-b/stock-advice/index' }); },
  onGoContact() { wx.navigateTo({ url: '/pages-b/contact-config/index' }); },
  onGoHotRank() { wx.navigateTo({ url: '/pages-b/hot-rank/index' }); },
  onGoMembership() { wx.navigateTo({ url: '/pages-b/membership/index' }); }
});
