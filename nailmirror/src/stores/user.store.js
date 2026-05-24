// userStore — 登录态 / profile / 每日出图额度
const { observable, action } = require('mobx-miniprogram');
const { safeGet, safeSet } = require('../utils/storage');
const { STORAGE_USER, DAILY_FREE_HD, STORAGE_DAILY_QUOTA } = require('../config/constants');

function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

const userStore = observable({
  openid: '',
  nickname: '',
  avatarUrl: '',
  role: 'c', // c | b
  membershipLevel: 0,
  lastRemoveDate: '',
  dailyFreeHDLeft: DAILY_FREE_HD,

  setUser: action(function (u) {
    this.openid = u.openid || this.openid;
    this.nickname = u.nickname || this.nickname;
    this.avatarUrl = u.avatarUrl || this.avatarUrl;
    this.role = u.role || this.role;
    this.membershipLevel = u.membershipLevel || 0;
    this.lastRemoveDate = u.lastRemoveDate || '';
    if (typeof u.dailyFreeHDLeft === 'number') this.dailyFreeHDLeft = u.dailyFreeHDLeft;
    safeSet(STORAGE_USER, { openid: this.openid, nickname: this.nickname, avatarUrl: this.avatarUrl, role: this.role, membershipLevel: this.membershipLevel, lastRemoveDate: this.lastRemoveDate });
  }),

  setRole: action(function (role) {
    this.role = role;
    safeSet(STORAGE_USER, { openid: this.openid, nickname: this.nickname, avatarUrl: this.avatarUrl, role, membershipLevel: this.membershipLevel, lastRemoveDate: this.lastRemoveDate });
  }),

  consumeFreeHD: action(function () {
    if (this.dailyFreeHDLeft > 0) {
      this.dailyFreeHDLeft -= 1;
      safeSet(STORAGE_DAILY_QUOTA, { day: todayKey(), left: this.dailyFreeHDLeft });
      return true;
    }
    return false;
  }),

  grantFreeHD: action(function (n = 1) {
    this.dailyFreeHDLeft += n;
    safeSet(STORAGE_DAILY_QUOTA, { day: todayKey(), left: this.dailyFreeHDLeft });
  }),

  logout: action(function () {
    this.openid = '';
    this.nickname = '';
    this.avatarUrl = '';
    this.role = 'c';
    this.membershipLevel = 0;
    safeSet(STORAGE_USER, null);
  }),

  init: action(function () {
    const cached = safeGet(STORAGE_USER, null);
    if (cached) {
      this.openid = cached.openid || '';
      this.nickname = cached.nickname || '';
      this.avatarUrl = cached.avatarUrl || '';
      this.role = cached.role || 'c';
      this.membershipLevel = cached.membershipLevel || 0;
      this.lastRemoveDate = cached.lastRemoveDate || '';
    }
    const q = safeGet(STORAGE_DAILY_QUOTA, null);
    if (q && q.day === todayKey()) {
      this.dailyFreeHDLeft = q.left;
    } else {
      this.dailyFreeHDLeft = DAILY_FREE_HD;
      safeSet(STORAGE_DAILY_QUOTA, { day: todayKey(), left: DAILY_FREE_HD });
    }
  })
});

module.exports = { userStore };
