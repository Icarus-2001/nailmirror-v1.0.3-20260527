/**
 * listSiteHotRank — C 端读取站内热度 Top10 快照
 * 若快照不存在则同步刷新一次（冷启动）
 */
const cloud = require('wx-server-sdk')
const { ensureCollection } = require('../utils/collections')
const { refreshSiteHotRank, SNAPSHOT_ID } = require('./refreshSiteHotRank')

async function listSiteHotRank() {
  const db = cloud.database()
  await ensureCollection(db, 'site_hot_rank')

  let doc
  try {
    doc = await db.collection('site_hot_rank').doc(SNAPSHOT_ID).get()
  } catch (e) {
    doc = { data: null }
  }

  if (!doc.data || !Array.isArray(doc.data.items)) {
    const refreshed = await refreshSiteHotRank()
    return {
      ok: true,
      rank_date: refreshed.rank_date,
      updated_at: refreshed.updated_at,
      items: refreshed.items,
      bootstrapped: true,
    }
  }

  const row = doc.data
  return {
    ok: true,
    rank_date: row.rank_date || '',
    updated_at: row.updated_at || null,
    items: row.items || [],
    bootstrapped: false,
  }
}

module.exports = { listSiteHotRank }
