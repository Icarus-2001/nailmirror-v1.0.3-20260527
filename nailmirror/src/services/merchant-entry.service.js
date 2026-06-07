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
  if (!cloudUtil.isCloudReady()) return 'phone';

  try {
    const gate = await cloudUtil.callFunction('ops', {
      action: 'getMerchantPhoneGate',
      openid,
    });
    if (gate && gate.ok && gate.merchantVerified && gate.phoneVerified) {
      return 'entry';
    }
    return 'phone';
  } catch (e) {
    return 'phone';
  }
}

function navigateByRoute(route) {
  const map = {
    login: '/pages/login/index?from=merchant',
    verify: '/pages-b/merchant-verify/index',
    phone: '/pages-b/entry/index',
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
