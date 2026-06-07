/**
 * 商家款式归属校验（styles.merchant_id ↔ merchants.openid）
 */
const { normalizeMerchantOpenid } = require('./merchant');

async function getOwnedMerchantStyle(db, openid, styleId) {
  if (!openid || !styleId) return null;
  const owner = normalizeMerchantOpenid(openid);
  let style;
  try {
    const doc = await db.collection('styles').doc(String(styleId)).get();
    style = doc.data;
  } catch (e) {
    return null;
  }
  if (!style || style.source !== 'merchant-upload') return null;
  if (String(style.merchant_id || '').trim() !== owner) return null;
  return style;
}

module.exports = { getOwnedMerchantStyle };
