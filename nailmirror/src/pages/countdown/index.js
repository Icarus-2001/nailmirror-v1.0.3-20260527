const { userStore } = require('../../stores/user.store');
const { REMOVE_CYCLE_DAYS } = require('../../config/constants');
const { daysBetween, formatDate } = require('../../utils/formatter');
const styleService = require('../../services/style.service');

Page({
  data: {
    days: REMOVE_CYCLE_DAYS,
    lastRemoveDate: '',
    nextSuggestDate: '',
    recommend: []
  },
  async onLoad() {
    userStore.init();
    const now = Date.now();
    const last = userStore.lastRemoveDate ? new Date(userStore.lastRemoveDate).getTime() : now;
    const passed = daysBetween(last, now);
    const days = Math.max(0, REMOVE_CYCLE_DAYS - passed);
    const nextTs = last + REMOVE_CYCLE_DAYS * 24 * 3600 * 1000;
    this.setData({
      days,
      lastRemoveDate: userStore.lastRemoveDate || formatDate(last),
      nextSuggestDate: formatDate(nextTs)
    });
    const r = await styleService.list({ page: 1, pageSize: 4 });
    this.setData({ recommend: r.items });
  },
  onResetToday() {
    const today = formatDate(Date.now());
    userStore.setUser({ lastRemoveDate: today });
    this.onLoad();
  }
});
