const { userStore } = require('../../stores/user.store');
const { BRAND_LOGO } = require('../../config/constants');
const { favoriteStore } = require('../../stores/favorite.store');
const { REMOVE_CYCLE_DAYS } = require('../../config/constants');
const { daysBetween } = require('../../utils/formatter');
const historyService = require('../../services/history.service');

Page({
  data: {
    user: null,
    needLogin: true,
    favCount: 0,
    historyCount: 0,
    countdownDays: 21
  },
  async onShow() {
    userStore.init();
    favoriteStore.init();
    const hist = await historyService.list();
    const loggedIn = !!userStore.openid;
    let days = REMOVE_CYCLE_DAYS;
    if (userStore.lastRemoveDate) {
      const last = new Date(userStore.lastRemoveDate).getTime();
      const now = Date.now();
      const passed = daysBetween(last, now);
      days = Math.max(0, REMOVE_CYCLE_DAYS - passed);
    }
    this.setData({
      needLogin: !loggedIn,
      user: {
        nickname: loggedIn ? (userStore.nickname || '微信用户') : '未登录',
        avatarUrl: userStore.avatarUrl || BRAND_LOGO,
        role: userStore.role,
        membershipLevel: userStore.membershipLevel
      },
      favCount: favoriteStore.ids.length,
      historyCount: hist.length,
      countdownDays: days
    });
  },
  onGoLogin() {
    if (!this.data.needLogin) return;
    wx.navigateTo({ url: '/pages/login/index' });
  },
  onGoHistory() { wx.navigateTo({ url: '/pages/me-history/index' }); },
  onGoFavorite() { wx.navigateTo({ url: '/pages/me-favorite/index' }); },
  onGoMembership() { wx.navigateTo({ url: '/pages/me-membership/index' }); },
  onGoCountdown() { wx.navigateTo({ url: '/pages/countdown/index' }); },
  onGoMerchant() { wx.navigateTo({ url: '/pages-b/entry/index' }); }
});
