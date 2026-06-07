/**
 * verifyMerchantPhone — 微信手机号快捷验证，比对商家认证手机号
 *
 * 入参：{ openid, code }  code 来自 button open-type="getPhoneNumber"
 * 成功：更新 merchants.last_phone_verified_at
 */
const cloud = require('wx-server-sdk');
const { ensureCollection } = require('../utils/collections');
const { normalizePhone } = require('../utils/phone');

async function verifyMerchantPhone({ openid, code }) {
  if (!openid) return { ok: false, error: '请先登录' };
  if (!code) return { ok: false, error: '请授权微信手机号' };

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

  let phoneInfo;
  try {
    const apiRes = await cloud.openapi.phonenumber.getPhoneNumber({ code });
    phoneInfo = apiRes && apiRes.phoneInfo;
  } catch (err) {
    console.error('[verifyMerchantPhone] getPhoneNumber failed:', err);
    return { ok: false, error: '手机号验证失败，请稍后重试' };
  }

  const wxPhone = normalizePhone(
    (phoneInfo && (phoneInfo.purePhoneNumber || phoneInfo.phoneNumber)) || ''
  );
  if (!wxPhone) {
    return { ok: false, error: '未能获取微信手机号' };
  }

  if (wxPhone !== boundPhone) {
    return { ok: false, error: '微信手机号与认证手机号不一致，请使用认证时绑定的号码' };
  }

  const now = new Date().toISOString();
  await db.collection('merchants').doc(merchant._id).update({
    data: { last_phone_verified_at: now, updated_at: now },
  });

  return { ok: true, phoneVerified: true, verifiedAt: now };
}

module.exports = { verifyMerchantPhone };
