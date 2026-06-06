// 商家身份认证状态（以云端 merchants 为准，不依赖本地 role 缓存）
const cloudUtil = require('../utils/cloud');

async function isMerchantVerified(openid) {
  if (!openid || !cloudUtil.isCloudReady()) return false;
  try {
    const res = await cloudUtil.callFunction('ops', {
      action: 'checkMerchantStatus',
      openid,
    });
    return !!(res && res.ok && res.verified);
  } catch (e) {
    return false;
  }
}

module.exports = { isMerchantVerified };
