/**
 * getMerchantPhoneGate — 已认证商家进入 B 端前的手机号核验门禁
 *
 * 入参：{ openid }
 * 返回：{ ok, merchantVerified, phoneVerified, phoneMasked, ttlHours }
 */
const cloud = require('wx-server-sdk');
const { ensureCollection } = require('../utils/collections');
const { maskPhone } = require('../utils/phone');

const PHONE_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

function parseTimestamp(val) {
  if (!val) return 0;
  if (val instanceof Date) return val.getTime();
  if (typeof val === 'object' && val.$date) return new Date(val.$date).getTime();
  const t = new Date(val).getTime();
  return Number.isFinite(t) ? t : 0;
}

function isPhoneRecentlyVerified(merchant) {
  const ts = parseTimestamp(merchant && merchant.last_phone_verified_at);
  if (!ts) return false;
  return (Date.now() - ts) < PHONE_VERIFY_TTL_MS;
}

async function getMerchantPhoneGate({ openid }) {
  if (!openid) {
    return { ok: true, merchantVerified: false, phoneVerified: false, phoneMasked: '' };
  }

  const db = cloud.database();
  await ensureCollection(db, 'merchants');

  const res = await db.collection('merchants').where({ openid }).limit(1).get();
  const merchant = res.data && res.data[0];
  const merchantVerified = !!(merchant && merchant.status !== 'rejected' && merchant.status !== 'revoked');

  if (!merchantVerified) {
    return { ok: true, merchantVerified: false, phoneVerified: false, phoneMasked: '' };
  }

  return {
    ok: true,
    merchantVerified: true,
    phoneVerified: isPhoneRecentlyVerified(merchant),
    phoneMasked: maskPhone(merchant.phone),
    ttlHours: 24,
  };
}

module.exports = { getMerchantPhoneGate, PHONE_VERIFY_TTL_MS, isPhoneRecentlyVerified };
