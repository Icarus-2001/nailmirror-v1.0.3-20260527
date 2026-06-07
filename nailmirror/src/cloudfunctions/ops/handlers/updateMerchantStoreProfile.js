/**
 * updateMerchantStoreProfile — B 端保存店铺信息（30 天仅可修改一次）
 */
const cloud = require('wx-server-sdk');
const { ensureCollection } = require('../utils/collections');
const { findMerchantByOpenid } = require('../utils/merchant');
const { normalizePhone } = require('../utils/phone');
const {
  BUSINESS_HOURS_MAX_LEN,
  storeProfileFromDoc,
  evaluateStoreProfileEditPolicy,
  buildCooldownError,
} = require('../utils/storeProfile');

async function updateMerchantStoreProfile({ openid, storeName, phone, businessHours }) {
  if (!openid) return { ok: false, error: '请先登录' };

  const name = String(storeName || '').trim();
  if (!name) return { ok: false, error: '请填写门店名称' };

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone || !/^1\d{10}$/.test(normalizedPhone)) {
    return { ok: false, error: '请输入正确的 11 位手机号' };
  }

  const hours = String(businessHours || '').trim();
  if (hours.length > BUSINESS_HOURS_MAX_LEN) {
    return { ok: false, error: '营业时间过长，请精简后保存' };
  }

  const db = cloud.database();
  await ensureCollection(db, 'merchants');

  const merchant = await findMerchantByOpenid(db, openid);
  if (!merchant || merchant.status === 'rejected' || merchant.status === 'revoked') {
    return { ok: false, error: '商家身份未通过认证' };
  }

  const editPolicy = evaluateStoreProfileEditPolicy(merchant);
  if (!editPolicy.canEdit) {
    return { ok: false, error: buildCooldownError(editPolicy.nextEditableAt) };
  }

  const now = new Date().toISOString();
  await db.collection('merchants').doc(merchant._id).update({
    data: {
      store_name: name,
      phone: normalizedPhone,
      business_hours: hours,
      store_profile_updated_at: now,
      updated_at: now,
    },
  });

  const updatedMerchant = Object.assign({}, merchant, {
    store_name: name,
    phone: normalizedPhone,
    business_hours: hours,
    store_profile_updated_at: now,
    updated_at: now,
  });

  return {
    ok: true,
    profile: storeProfileFromDoc(updatedMerchant),
    editPolicy: evaluateStoreProfileEditPolicy(updatedMerchant),
  };
}

module.exports = { updateMerchantStoreProfile };
