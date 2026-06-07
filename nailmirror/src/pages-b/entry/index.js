const { userStore } = require('../../stores/user.store');
const merchantAuthService = require('../../services/merchant-auth.service');
const merchantEntryService = require('../../services/merchant-entry.service');
const { ensurePrivacyAuthorized } = require('../../utils/privacy');

Page({
  data: {
    role: 'c',
    checking: true
  },
  onReady() {
    ensurePrivacyAuthorized().catch(() => {});
  },

  async onShow() {
    userStore.init();
    this.setData({ checking: true });

    if (!userStore.openid) {
      wx.redirectTo({ url: '/pages/login/index?from=merchant' });
      return;
    }

    try {
      const verified = await merchantAuthService.isMerchantVerified(userStore.openid);
      if (!verified) {
        userStore.setRole('c');
        wx.redirectTo({ url: '/pages-b/merchant-verify/index' });
        return;
      }

      const route = await merchantEntryService.resolveMerchantEntryRoute(userStore.openid);
      if (route === 'phone') {
        wx.redirectTo({ url: '/pages-b/merchant-phone-verify/index' });
        return;
      }

      userStore.setRole('b');
      this.setData({ role: 'b', checking: false });
    } catch (e) {
      wx.showToast({ title: '商家身份校验失败，请稍后重试', icon: 'none' });
      this.setData({ role: userStore.role || 'c', checking: false });
    }
  },
  onSwitchToC() {
    userStore.setRole('c');
    wx.navigateBack();
  },
  onGoDashboard() { wx.navigateTo({ url: '/pages-b/dashboard/index' }); },
  onGoStyleUpload() { wx.navigateTo({ url: '/pages-b/style-upload/index' }); },
  onGoContact() { wx.navigateTo({ url: '/pages-b/contact-config/index' }); },
  onGoMembership() { wx.navigateTo({ url: '/pages-b/membership/index' }); }
});
