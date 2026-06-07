/**
 * listFavorites — 读取指定用户的收藏款式 ID 列表
 */
const cloud = require('wx-server-sdk')
const { ensureCollection } = require('../utils/collections')
const { resolveOpenid } = require('../utils/resolveOpenid')

function toMs(val) {
  if (!val) return 0
  if (val instanceof Date) return val.getTime()
  if (typeof val === 'object' && val.$date) return new Date(val.$date).getTime()
  const t = new Date(val).getTime()
  return Number.isFinite(t) ? t : 0
}

async function listFavorites({ openid }) {
  const uid = resolveOpenid(openid)
  if (!uid) {
    return { ok: false, error: '缺少 openid' }
  }

  const db = cloud.database()
  await ensureCollection(db, 'user_favorites')

  const res = await db.collection('user_favorites')
    .where({ user_id: uid })
    .limit(200)
    .get()

  const styleIds = (res.data || [])
    .sort((a, b) => toMs(b.created_at) - toMs(a.created_at))
    .map((r) => r.style_id)

  return { ok: true, styleIds, user_id: uid }
}

module.exports = { listFavorites }
