/**
 * 商家店铺信息（B 端编辑）— 字段映射与 30 天冷却策略
 */
const STORE_PROFILE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const BUSINESS_HOURS_MAX_LEN = 50;

function toMs(val) {
  if (val == null || val === '') return 0;
  const t = new Date(val).getTime();
  return Number.isFinite(t) ? t : 0;
}

function formatDateYMD(ms) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function storeProfileFromDoc(merchant) {
  if (!merchant) return null;
  return {
    storeName: merchant.store_name || '',
    phone: merchant.phone || '',
    businessHours: merchant.business_hours || '',
    province: merchant.province || '',
    city: merchant.city || '',
  };
}

function evaluateStoreProfileEditPolicy(merchant) {
  const updatedAt = merchant && merchant.store_profile_updated_at;
  if (!updatedAt) {
    return { canEdit: true, nextEditableAt: null };
  }
  const lastMs = toMs(updatedAt);
  if (!lastMs) {
    return { canEdit: true, nextEditableAt: null };
  }
  const nextMs = lastMs + STORE_PROFILE_COOLDOWN_MS;
  if (Date.now() >= nextMs) {
    return { canEdit: true, nextEditableAt: null };
  }
  return {
    canEdit: false,
    nextEditableAt: formatDateYMD(nextMs),
  };
}

function buildCooldownError(nextEditableAt) {
  const date = nextEditableAt || '';
  return '店铺信息每月仅可修改一次，请于 ' + date + ' 后再试';
}

module.exports = {
  STORE_PROFILE_COOLDOWN_MS,
  BUSINESS_HOURS_MAX_LEN,
  storeProfileFromDoc,
  evaluateStoreProfileEditPolicy,
  buildCooldownError,
  formatDateYMD,
};
