/**
 * checkStyleAvailability — 款式是否可访问（含商家注销 interim 态）
 *
 * 入参：{ styleId }
 * 返回：{ ok, available, reason? }  reason: not_found | inactive | merchant_revoked
 */
const cloud = require('wx-server-sdk');
const { findMerchantByOpenid } = require('../utils/merchant');

async function checkStyleAvailability({ styleId }) {
  if (!styleId) return { ok: false, error: '缺少款式 ID' };

  const db = cloud.database();
  let style;
  try {
    const doc = await db.collection('styles').doc(String(styleId)).get();
    style = doc.data;
  } catch (e) {
    return { ok: true, available: false, reason: 'not_found' };
  }

  if (!style) return { ok: true, available: false, reason: 'not_found' };
  if (style.is_active !== false) return { ok: true, available: true };

  if (style.source === 'merchant-upload' && style.merchant_id) {
    const merchant = await findMerchantByOpenid(db, style.merchant_id);
    if (merchant && merchant.status === 'revoked') {
      return { ok: true, available: false, reason: 'merchant_revoked' };
    }
  }

  return { ok: true, available: false, reason: 'inactive' };
}

module.exports = { checkStyleAvailability };
