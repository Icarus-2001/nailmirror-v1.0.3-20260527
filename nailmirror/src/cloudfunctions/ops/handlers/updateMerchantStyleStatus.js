/**
 * updateMerchantStyleStatus — B 端商家上架/下架自有款式
 *
 * 入参：{ openid, styleId, is_active }
 */
const cloud = require('wx-server-sdk');
const { getOwnedMerchantStyle } = require('../utils/merchantStyleOwnership');

async function updateMerchantStyleStatus({ openid, styleId, is_active }) {
  if (!openid) return { ok: false, error: '请先登录' };
  if (!styleId) return { ok: false, error: '缺少款式 ID' };
  if (typeof is_active !== 'boolean') {
    return { ok: false, error: '缺少 is_active 参数' };
  }

  const db = cloud.database();
  const style = await getOwnedMerchantStyle(db, openid, styleId);
  if (!style) return { ok: false, error: '款式不存在或无权操作' };

  const now = new Date().toISOString();
  const patch = { is_active, updated_at: now };
  if (is_active) {
    patch.deactivated_at = null;
  } else {
    patch.deactivated_at = now;
  }

  await db.collection('styles').doc(String(styleId)).update({ data: patch });
  return { ok: true, styleId, is_active };
}

module.exports = { updateMerchantStyleStatus };
