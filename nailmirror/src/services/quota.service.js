// 高清出片每日免费额度：校验与扣减统一入口（由 ENABLE_FREE_HD_QUOTA 开关）
const { makeError } = require('../utils/request');
const ERR = require('../config/error-codes');
const { userStore } = require('../stores/user.store');
const featureFlags = require('../config/feature-flags');

let _userInited = false;
function ensureUserInit() {
  if (!_userInited) {
    userStore.init();
    _userInited = true;
  }
}

function isFreeHDQuotaEnabled() {
  return featureFlags.ENABLE_FREE_HD_QUOTA === true;
}

function assertFreeHD() {
  if (!isFreeHDQuotaEnabled()) return;
  ensureUserInit();
  if (userStore.dailyFreeHDLeft <= 0) {
    throw makeError(ERR.QUOTA_EXCEEDED, '今日免费出图次数已用完');
  }
}

function consumeFreeHDOnSuccess() {
  if (!isFreeHDQuotaEnabled()) return true;
  ensureUserInit();
  return userStore.consumeFreeHD();
}

function getQuotaLeft() {
  ensureUserInit();
  return userStore.dailyFreeHDLeft;
}

module.exports = {
  isFreeHDQuotaEnabled,
  assertFreeHD,
  consumeFreeHDOnSuccess,
  getQuotaLeft
};
