/**
 * getStyleHeatScores — 计算平台款/商家款的站内热度分
 */
const cloud = require('wx-server-sdk')
const { getAll } = require('../utils/db')
const { ensureCollection } = require('../utils/collections')
const {
  toMs,
  capDays,
  computeHeatScoresFromData,
} = require('../utils/styleHeat')

async function getStyleHeatScores() {
  const db = cloud.database()
  await ensureCollection(db, 'user_favorites')
  await ensureCollection(db, 'user_events')

  const now = Date.now()
  const [events, tryLogs, favDocs, styles] = await Promise.all([
    getAll('user_events', {}),
    getAll('try_on_logs', {}),
    getAll('user_favorites', {}),
    getAll('styles', {}),
  ])

  const heatScores = computeHeatScoresFromData(styles, events, tryLogs, favDocs, now)
  return { ok: true, heatScores }
}

module.exports = { getStyleHeatScores, toMs, capDays }
