/**
 * refreshSiteHotRank — 计算站内热度 Top10 并写入 site_hot_rank 快照
 *
 * 候选池：平台特供（real-1…25）+ 云库 merchant-upload 激活款
 * 排序：getStyleHeatScores 算法热度降序，取 Top10
 * 触发：每日 10:00 定时 / 手动 action / listSiteHotRank 冷启动
 */
const cloud = require('wx-server-sdk')
const { getAll } = require('../utils/db')
const { ensureCollection } = require('../utils/collections')
const { getStyleHeatScores } = require('./getStyleHeatScores')
const PLATFORM_STYLE_IDS = require('../data/platform-style-ids')

const SNAPSHOT_ID = 'latest'

function isEligibleStyleId(styleId) {
  if (!styleId) return false
  const id = String(styleId)
  if (id.indexOf('custom-') === 0) return false
  if (id.indexOf('xhs-hot') === 0) return false
  return true
}

/** 合并平台目录 id 与商家款 id 为候选池 */
function buildCandidatePool(platformIds, merchantStyles) {
  const ids = new Set((platformIds || []).filter(isEligibleStyleId))
  ;(merchantStyles || []).forEach((row) => {
    const id = row._id || row.id
    if (isEligibleStyleId(id)) ids.add(id)
  })
  return Array.from(ids)
}

/** 按热度降序取 Top10（同分按 styleId 字典序稳定排序） */
function sortTop10(candidateIds, heatScores) {
  return candidateIds
    .map((styleId) => ({ styleId, heat: (heatScores && heatScores[styleId]) || 0 }))
    .sort((a, b) => {
      if (b.heat !== a.heat) return b.heat - a.heat
      return String(a.styleId).localeCompare(String(b.styleId), 'zh-CN')
    })
    .slice(0, 10)
    .map((item, index) => ({
      styleId: item.styleId,
      rank: index + 1,
      heat: item.heat,
    }))
}

function formatRankDate(date) {
  const d = date || new Date()
  return d.getFullYear() + '-'
    + String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0')
}

async function refreshSiteHotRank() {
  const db = cloud.database()
  await ensureCollection(db, 'site_hot_rank')

  const [{ heatScores }, merchantStyles] = await Promise.all([
    getStyleHeatScores(),
    getAll('styles', { source: 'merchant-upload', is_active: true }),
  ])

  const candidateIds = buildCandidatePool(PLATFORM_STYLE_IDS, merchantStyles)
  const items = sortTop10(candidateIds, heatScores)
  const now = new Date()
  const payload = {
    rank_date: formatRankDate(now),
    updated_at: db.serverDate(),
    items,
  }

  await db.collection('site_hot_rank').doc(SNAPSHOT_ID).set({ data: payload })

  return {
    ok: true,
    rank_date: payload.rank_date,
    updated_at: now.toISOString(),
    itemCount: items.length,
    items,
  }
}

module.exports = {
  refreshSiteHotRank,
  buildCandidatePool,
  sortTop10,
  SNAPSHOT_ID,
}
