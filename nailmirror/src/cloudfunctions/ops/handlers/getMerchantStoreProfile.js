/**
 * getMerchantStoreProfile — B 端读取本店店铺信息
 */
const cloud = require('wx-server-sdk');
const { ensureCollection } = require('../utils/collections');
const { findMerchantByOpenid } = require('../utils/merchant');
const {
  storeProfileFromDoc,
  evaluateStoreProfileEditPolicy,
} = require('../utils/storeProfile');

async function getMerchantStoreProfile({ openid }) {
  if (!openid) return { ok: false, error: '请先登录' };

  const db = cloud.database();
  await ensureCollection(db, 'merchants');

  const merchant = await findMerchantByOpenid(db, openid);
  if (!merchant || merchant.status === 'rejected' || merchant.status === 'revoked') {
    return { ok: false, error: '商家身份未通过认证' };
  }

  const profile = storeProfileFromDoc(merchant);
  const editPolicy = evaluateStoreProfileEditPolicy(merchant);

  return {
    ok: true,
    profile,
    editPolicy,
  };
}

module.exports = { getMerchantStoreProfile };
