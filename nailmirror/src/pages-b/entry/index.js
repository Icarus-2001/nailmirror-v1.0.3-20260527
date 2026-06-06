const { userStore } = require('../../stores/user.store');
const merchantAuthService = require('../../services/merchant-auth.service');

Page({
  data: {
    role: 'c',
    checking: true
  },
  async onShow() {
    userStore.init();
    this.setData({ checking: true });

    if (!userStore.openid) {
      userStore.setRole('c');
      wx.redirectTo({ url: '/pages-b/merchant-verify/index' });
      return;
    }

    try {
      const verified = await merchantAuthService.isMerchantVerified(userStore.openid);
      if (!verified) {
        userStore.setRole('c');
        wx.redirectTo({ url: '/pages-b/merchant-verify/index' });
        return;
      }
      userStore.setRole('b');
      this.setData({ role: 'b', checking: false });
    } catch (e) {
      userStore.setRole('c');
      wx.showToast({ title: '验证状态获取失败', icon: 'none' });
      wx.redirectTo({ url: '/pages-b/merchant-verify/index' });
    }
  },
  onSwitchToC() {
    userStore.setRole('c');
    wx.navigateBack();
  },
  onGoDashboard() { wx.navigateTo({ url: '/pages-b/dashboard/index' }); },
  onGoStyleUpload() { wx.navigateTo({ url: '/pages-b/style-upload/index' }); },
  onGoStock() { wx.navigateTo({ url: '/pages-b/stock-advice/index' }); },
  onGoContact() { wx.navigateTo({ url: '/pages-b/contact-config/index' }); },
  onGoHotRank() { wx.navigateTo({ url: '/pages-b/hot-rank/index' }); },
  onGoMembership() { wx.navigateTo({ url: '/pages-b/membership/index' }); }
});
