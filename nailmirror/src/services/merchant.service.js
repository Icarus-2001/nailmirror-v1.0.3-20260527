/**
 * MerchantService — B 端店铺信息（云端 merchants 集合）
 */
const cloudUtil = require('../utils/cloud');
const { userStore } = require('../stores/user.store');

function mapProfileToCfg(profile, editPolicy) {
  const p = profile || {};
  const policy = editPolicy || { canEdit: true, nextEditableAt: null };
  return {
    name: p.storeName || '',
    phone: p.phone || '',
    businessHours: p.businessHours || '',
    province: p.province || '',
    city: p.city || '',
    canEdit: policy.canEdit !== false,
    nextEditableAt: policy.nextEditableAt || '',
  };
}

async function getConfig() {
  if (!cloudUtil.isCloudReady()) {
    throw new Error('云开发未就绪');
  }
  const res = await cloudUtil.callFunction('ops', {
    action: 'getMerchantStoreProfile',
    role: 'b',
    openid: userStore.openid || '',
  });
  if (!res || !res.ok) {
    throw new Error((res && res.error) || '加载店铺信息失败');
  }
  return mapProfileToCfg(res.profile, res.editPolicy);
}

async function saveConfig(cfg) {
  if (!cloudUtil.isCloudReady()) {
    throw new Error('云开发未就绪');
  }
  const res = await cloudUtil.callFunction('ops', {
    action: 'updateMerchantStoreProfile',
    role: 'b',
    openid: userStore.openid || '',
    storeName: (cfg && cfg.name) || '',
    phone: (cfg && cfg.phone) || '',
    businessHours: (cfg && cfg.businessHours) || '',
  });
  if (!res || !res.ok) {
    throw new Error((res && res.error) || '保存失败');
  }
  return {
    ok: true,
    merchant: mapProfileToCfg(res.profile, res.editPolicy),
  };
}

module.exports = { getConfig, saveConfig };
