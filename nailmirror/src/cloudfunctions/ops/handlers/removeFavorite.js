/**
 * removeFavorite — 取消用户收藏，从 user_favorites 删除
 */
const cloud = require('wx-server-sdk')
const { resolveOpenid } = require('../utils/resolveOpenid')

async function removeFavorite({ openid, styleId }) {
  const uid = resolveOpenid(openid)
  if (!uid || !styleId) {
    return { ok: false, error: '缺少 openid 或 styleId' }
  }

  const db = cloud.database()
  const res = await db.collection('user_favorites')
    .where({ user_id: uid, style_id: styleId })
    .get()

  if (res.data && res.data.length) {
    await db.collection('user_favorites').doc(res.data[0]._id).remove()
  }
  return { ok: true, user_id: uid }
}

module.exports = { removeFavorite }
