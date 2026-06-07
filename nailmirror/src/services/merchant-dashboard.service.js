const cloudUtil = require('../utils/cloud');
const { userStore } = require('../stores/user.store');

async function fetchDashboard() {
  if (!cloudUtil.isCloudReady()) {
    throw new Error('云开发未就绪');
  }
  const res = await cloudUtil.callFunction('ops', {
    action: 'getMerchantDashboard',
    role: 'b',
    openid: userStore.openid || '',
  });
  if (!res || !res.ok) {
    throw new Error((res && res.error) || '看板加载失败');
  }
  return res;
}

module.exports = {
  fetchDashboard,
};
