const { userStore } = require('../../stores/user.store');
const { BRAND_LOGO } = require('../../config/constants');
const { ensurePrivacyAuthorized } = require('../../utils/privacy');

Page({
  data: {
    user: null,
    needLogin: true
  },
  onReady() {
    ensurePrivacyAuthorized().catch(() => {});
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
  onAvatarError() {
    const user = Object.assign({}, this.data.user || {}, { avatarUrl: BRAND_LOGO });
    this.setData({ user });
  },
  onGoHistory() { wx.navigateTo({ url: '/pages/me-history/index' }); },
  onGoFavorite() { wx.navigateTo({ url: '/pages/me-favorite/index' }); },
  onGoMembership() { wx.navigateTo({ url: '/pages/me-membership/index' }); },
  onGoMerchant() {
    userStore.init();
    if (!userStore.openid) {
      wx.navigateTo({ url: '/pages/login/index?from=merchant' });
      return;
    }
    wx.navigateTo({ url: '/pages-b/entry/index' });
  }
});
