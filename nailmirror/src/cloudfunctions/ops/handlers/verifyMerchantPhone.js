/**
 * verifyMerchantPhone — 比对商家认证手机号
 *
 * 入参：{ openid, phone }  phone 为商家手动输入的 11 位手机号（与认证资料比对）
 * 成功：更新 merchants.last_phone_verified_at
 */
const cloud = require('wx-server-sdk');
const { ensureCollection } = require('../utils/collections');
const { normalizePhone } = require('../utils/phone');

async function verifyMerchantPhone({ openid, phone }) {
  if (!openid) return { ok: false, error: '请先登录' };

  const inputPhone = normalizePhone(phone);
  if (!inputPhone || !/^1\d{10}$/.test(inputPhone)) {
    return { ok: false, error: '请输入正确的 11 位手机号' };
  }

  const db = cloud.database();
  await ensureCollection(db, 'merchants');

  const res = await db.collection('merchants').where({ openid }).limit(1).get();
  const merchant = res.data && res.data[0];
  if (!merchant || merchant.status === 'rejected' || merchant.status === 'revoked') {
    return { ok: false, error: '商家身份未通过认证' };
  }

  const boundPhone = normalizePhone(merchant.phone);
  if (!boundPhone) {
    return { ok: false, error: '认证资料缺少手机号，请重新完成商家认证' };
  }

  if (inputPhone !== boundPhone) {
    return { ok: false, error: '手机号与认证资料不一致，请填写认证时绑定的号码' };
  }

  const now = new Date().toISOString();
  await db.collection('merchants').doc(merchant._id).update({
    data: { last_phone_verified_at: now, updated_at: now },
  });

  return { ok: true, phoneVerified: true, verifiedAt: now };
}

module.exports = { verifyMerchantPhone };
