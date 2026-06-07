/**
 * addFavorite — 用户收藏款式，写入云数据库 user_favorites 集合
 */
const cloud = require('wx-server-sdk')
const { ensureCollection } = require('../utils/collections')
const { resolveOpenid } = require('../utils/resolveOpenid')

async function addFavorite({ openid, styleId }) {
  const uid = resolveOpenid(openid)
  if (!uid || !styleId) {
    console.error('[addFavorite] 缺少 openid 或 styleId', { uid, styleId })
    return { ok: false, error: '缺少 openid 或 styleId' }
  }

  const db = cloud.database()
  await ensureCollection(db, 'user_favorites')

  const exist = await db.collection('user_favorites')
    .where({ user_id: uid, style_id: styleId })
    .count()

  if (exist.total === 0) {
    const addRes = await db.collection('user_favorites').add({
      data: {
        user_id: uid,
        style_id: styleId,
        created_at: db.serverDate(),
      },
    })
    return { ok: true, id: addRes._id, user_id: uid }
  }

  return { ok: true, duplicate: true, user_id: uid }
}

module.exports = { addFavorite }
