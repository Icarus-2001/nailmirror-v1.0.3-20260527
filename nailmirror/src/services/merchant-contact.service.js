// C 端商详「联系商家」：按款式 ID 从云端拉取 merchants 真实档案
const cloudUtil = require('../utils/cloud');

async function getContactByStyleId(styleId) {
  if (!styleId || !cloudUtil.isCloudReady()) return null;
  try {
    const res = await cloudUtil.callFunction('ops', {
      action: 'getMerchantContact',
      styleId,
    });
    return res || null;
  } catch (e) {
    return null;
  }
}

module.exports = { getContactByStyleId };
