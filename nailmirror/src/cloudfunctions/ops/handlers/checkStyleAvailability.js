/**
 * checkStyleAvailability — 款式是否可访问（含商家注销/下架 interim 态）
 *
 * 入参：{ styleId }
 * 返回：{ ok, available, reason? }
 *   reason: not_found | inactive | style_inactive | merchant_revoked
 */
const cloud = require('wx-server-sdk');
const { findMerchantByOpenid } = require('../utils/merchant');
const { SNAPSHOT_ID } = require('./refreshSiteHotRank');

async function isInHotRankSnapshot(db, styleId) {
  try {
    const doc = await db.collection('site_hot_rank').doc(SNAPSHOT_ID).get();
    const items = (doc.data && doc.data.items) || [];
    return items.some((item) => item && String(item.styleId) === String(styleId));
  } catch (e) {
    return false;
  }
}

async function checkStyleAvailability({ styleId }) {
  if (!styleId) return { ok: false, error: '缺少款式 ID' };

  const db = cloud.database();
  let style;
  try {
    const doc = await db.collection('styles').doc(String(styleId)).get();
    style = doc.data;
  } catch (e) {
    style = null;
  }

  if (!style) {
    const inRank = await isInHotRankSnapshot(db, styleId);
    if (inRank) {
      return { ok: true, available: false, reason: 'style_inactive' };
    }
    return { ok: true, available: false, reason: 'not_found' };
  }

  if (style.is_active !== false) {
    return { ok: true, available: true };
  }

  if (style.source === 'merchant-upload' && style.merchant_id) {
    const merchant = await findMerchantByOpenid(db, style.merchant_id);
    if (merchant && merchant.status === 'revoked') {
      return { ok: true, available: false, reason: 'merchant_revoked' };
    }
    return { ok: true, available: false, reason: 'style_inactive' };
  }

  return { ok: true, available: false, reason: 'inactive' };
}

module.exports = { checkStyleAvailability };
