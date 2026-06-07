const { userStore } = require('../../stores/user.store');
const { BRAND_LOGO } = require('../../config/constants');
const merchantAuthService = require('../../services/merchant-auth.service');

Page({
  data: {
    user: null,
    needLogin: true
  },
  async onShow() {
    userStore.init();
    const loggedIn = !!userStore.openid;
    this.setData({
      needLogin: !loggedIn,
      user: {
        nickname: loggedIn ? (userStore.nickname || '微信用户') : '未登录',
        avatarUrl: userStore.avatarUrl || BRAND_LOGO,
        role: userStore.role,
        membershipLevel: userStore.membershipLevel
      }
    });
  },
  onGoLogin() {
    if (!this.data.needLogin) return;
    wx.navigateTo({ url: '/pages/login/index?from=me' });
  },
  onGoHistory() { wx.navigateTo({ url: '/pages/me-history/index' }); },
  onGoFavorite() { wx.navigateTo({ url: '/pages/me-favorite/index' }); },
  onGoMembership() { wx.navigateTo({ url: '/pages/me-membership/index' }); },
  async onGoMerchant() {
    userStore.init();
    if (!userStore.openid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '加载中', mask: true });
    try {
      const verified = await merchantAuthService.isMerchantVerified(userStore.openid);
      if (verified) {
        userStore.setRole('b');
        wx.navigateTo({ url: '/pages-b/entry/index' });
      } else {
        userStore.setRole('c');
        wx.navigateTo({ url: '/pages-b/merchant-verify/index' });
      }
    } catch (e) {
      wx.showToast({ title: '网络异常，请稍后重试', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  }
});
