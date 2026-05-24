const { userStore } = require('../../stores/user.store');
const { favoriteStore } = require('../../stores/favorite.store');
const { REMOVE_CYCLE_DAYS } = require('../../config/constants');
const { daysBetween } = require('../../utils/formatter');
const historyService = require('../../services/history.service');

Page({
  data: {
    user: null,
    favCount: 0,
    historyCount: 0,
    countdownDays: 21
  },
  async onShow() {
    userStore.init();
    favoriteStore.init();
    const hist = await historyService.list();
    let days = REMOVE_CYCLE_DAYS;
    if (userStore.lastRemoveDate) {
      const last = new Date(userStore.lastRemoveDate).getTime();
      const now = Date.now();
      const passed = daysBetween(last, now);
      days = Math.max(0, REMOVE_CYCLE_DAYS - passed);
    }
    this.setData({
      user: {
        nickname: userStore.nickname || '未登录',
        avatarUrl: userStore.avatarUrl || 'https://picsum.photos/seed/avatar/120/120',
        role: userStore.role,
        membershipLevel: userStore.membershipLevel
      },
      favCount: favoriteStore.ids.length,
      historyCount: hist.length,
      countdownDays: days
    });
  },
  onGoHistory() { wx.navigateTo({ url: '/pages/me-history/index' }); },
  onGoFavorite() { wx.navigateTo({ url: '/pages/me-favorite/index' }); },
  onGoMembership() { wx.navigateTo({ url: '/pages/me-membership/index' }); },
  onGoCountdown() { wx.navigateTo({ url: '/pages/countdown/index' }); },
  onGoMerchant() { wx.navigateTo({ url: '/pages-b/entry/index' }); }
});
