/**
 * revokeMerchantQualification — 商家注销资质
 *
 * 入参：{ openid, phone }  须与 merchants.phone 一致
 * 效果：merchants.status=revoked；名下 merchant-upload 款式 is_active=false
 */
const cloud = require('wx-server-sdk');
const { ensureCollection } = require('../utils/collections');
const { getAll } = require('../utils/db');
const { findMerchantByOpenid } = require('../utils/merchant');
const { normalizePhone } = require('../utils/phone');

async function revokeMerchantQualification({ openid, phone }) {
  if (!openid) return { ok: false, error: '请先登录' };

  const inputPhone = normalizePhone(phone);
  if (!inputPhone || !/^1\d{10}$/.test(inputPhone)) {
    return { ok: false, error: '请输入正确的 11 位手机号' };
  }

  const db = cloud.database();
  await ensureCollection(db, 'merchants');
  await ensureCollection(db, 'styles');

  const merchant = await findMerchantByOpenid(db, openid);
  if (!merchant || merchant.status === 'rejected') {
    return { ok: false, error: '商家身份未通过认证' };
  }
  if (merchant.status === 'revoked') {
    return { ok: false, error: '商家资质已注销' };
  }

  const boundPhone = normalizePhone(merchant.phone);
  if (!boundPhone) {
    return { ok: false, error: '认证资料缺少手机号，无法注销' };
  }
  if (inputPhone !== boundPhone) {
    return { ok: false, error: '手机号与认证资料不一致' };
  }

  const now = new Date().toISOString();
  await db.collection('merchants').doc(merchant._id).update({
    data: {
      status: 'revoked',
      revoked_at: now,
      last_phone_verified_at: null,
      updated_at: now,
    },
  });

  const ownerOpenid = String(merchant.openid || openid).trim();
  const styles = await getAll('styles', {
    source: 'merchant-upload',
    merchant_id: ownerOpenid,
    is_active: true,
  });

  if (styles.length > 0) {
    await db.collection('styles').where({
      source: 'merchant-upload',
      merchant_id: ownerOpenid,
      is_active: true,
    }).update({
      data: { is_active: false, deactivated_at: now, updated_at: now },
    });
  }

  try {
    await ensureCollection(db, 'users');
    const userDoc = await db.collection('users').doc(openid).get();
    if (userDoc.data) {
      await db.collection('users').doc(openid).update({
        data: { role: 'c', updated_at: now },
      });
    }
  } catch (e) {
    // users 集合不存在或文档缺失时不阻断注销
  }

  return {
    ok: true,
    revoked: true,
    stylesDeactivated: styles.length,
    revokedAt: now,
  };
}

module.exports = { revokeMerchantQualification };
