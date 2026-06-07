/**
 * 商家经营入口路由：未认证 → 资质验证；已认证 → 手机号核验 → 商家中心
 */
const cloudUtil = require('../utils/cloud');
const merchantAuthService = require('./merchant-auth.service');

/**
 * @returns {Promise<'login'|'verify'|'phone'|'entry'>}
 */
async function resolveMerchantEntryRoute(openid) {
  if (!openid) return 'login';
  const verified = await merchantAuthService.isMerchantVerified(openid);
  if (!verified) return 'verify';
  if (!cloudUtil.isCloudReady()) return 'entry';

  try {
    const gate = await cloudUtil.callFunction('ops', {
      action: 'getMerchantPhoneGate',
      openid,
    });
    if (gate && gate.ok && gate.merchantVerified && !gate.phoneVerified) {
      return 'phone';
    }
  } catch (e) {
    // 云端不可用时降级放行，避免阻断 B 端
  }
  return 'entry';
}

function navigateByRoute(route) {
  const map = {
    login: '/pages/login/index?from=merchant',
    verify: '/pages-b/merchant-verify/index',
    phone: '/pages-b/merchant-phone-verify/index',
    entry: '/pages-b/entry/index',
  };
  const url = map[route] || map.entry;
  if (route === 'entry' || route === 'verify' || route === 'phone') {
    wx.redirectTo({ url, fail: () => wx.navigateTo({ url }) });
    return;
  }
  wx.navigateTo({ url });
}

async function goMerchantEntry(openid) {
  const route = await resolveMerchantEntryRoute(openid);
  navigateByRoute(route);
}

module.exports = {
  resolveMerchantEntryRoute,
  navigateByRoute,
  goMerchantEntry,
};
