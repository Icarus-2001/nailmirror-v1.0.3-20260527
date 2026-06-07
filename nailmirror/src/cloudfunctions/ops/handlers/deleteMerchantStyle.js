/**
 * deleteMerchantStyle — B 端商家彻底删除自有款式（不可逆）
 */
const cloud = require('wx-server-sdk');
const { getAll } = require('../utils/db');
const { getOwnedMerchantStyle } = require('../utils/merchantStyleOwnership');

async function removeByStyleId(db, collectionName, styleId) {
  const rows = await getAll(collectionName, { style_id: styleId });
  for (const row of rows) {
    if (!row._id) continue;
    try {
      await db.collection(collectionName).doc(row._id).remove();
    } catch (e) {
      console.warn(`[deleteMerchantStyle] remove ${collectionName}/${row._id} failed:`, e && e.message);
    }
  }
  return rows.length;
}

async function deleteMerchantStyle({ openid, styleId }) {
  if (!openid) return { ok: false, error: '请先登录' };
  if (!styleId) return { ok: false, error: '缺少款式 ID' };

  const db = cloud.database();
  const style = await getOwnedMerchantStyle(db, openid, styleId);
  if (!style) return { ok: false, error: '款式不存在或无权操作' };

  const sid = String(styleId);
  const ratingsRemoved = await removeByStyleId(db, 'style_ratings', sid);
  const tryonRemoved = await removeByStyleId(db, 'try_on_logs', sid);
  const favoritesRemoved = await removeByStyleId(db, 'user_favorites', sid);
  let eventsRemoved = 0;
  try {
    eventsRemoved = await removeByStyleId(db, 'user_events', sid);
  } catch (e) {
    // user_events 集合可能不存在
  }

  const fileID = style.image_file_id;
  if (fileID) {
    try {
      await cloud.deleteFile({ fileList: [fileID] });
    } catch (e) {
      console.warn('[deleteMerchantStyle] deleteFile failed:', e && e.message);
    }
  }

  await db.collection('styles').doc(sid).remove();

  return {
    ok: true,
    styleId: sid,
    removed: {
      ratings: ratingsRemoved,
      tryonLogs: tryonRemoved,
      favorites: favoritesRemoved,
      events: eventsRemoved,
    },
  };
}

module.exports = { deleteMerchantStyle };
