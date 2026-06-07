/**
 * getStyleHeatScores — 计算平台款/商家款的站内热度分
 *
 * 算法（近30天行为窗口）：
 *   UV         = 款式曝光去重用户数（style_detail_view：商详进入或试戴选款点击，user_id 去重）
 *   收藏数      = 当前有效收藏且 created_at 在近30天内
 *   试戴完成数  = try_on_logs 近30天记录数（不去重，每次成功合成计1）
 *   基础分      = UV×3 + 收藏×30 + 试戴完成×50
 *   转化率加成  = UV>0 ? (试戴完成/UV)×200 : 0
 *   天数        = 距最近一次触达（商详/试戴/收藏）的天数；无触达用 created_at；MIN(天数,30)
 *   时间衰减    = e^(-0.023 × 天数)
 *   最终热度    = (基础分 + 转化率加成) × 时间衰减系数
 *
 * 仅适用于站内款式（平台特供 / 来自商家）；xhs-hot 全网热款不参与本算法。
 */
const cloud = require('wx-server-sdk')
const { getAll } = require('../utils/db')
const { ensureCollection } = require('../utils/collections')

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const MS_PER_DAY = 86400000

function toMs(val) {
  if (!val) return 0
  if (val instanceof Date) return val.getTime()
  if (typeof val === 'object' && val.$date) return new Date(val.$date).getTime()
  const t = new Date(val).getTime()
  return Number.isFinite(t) ? t : 0
}

function daysSince(ts, nowMs) {
  if (!ts) return 0
  return Math.max(0, (nowMs - ts) / MS_PER_DAY)
}

function capDays(days) {
  return Math.min(Math.floor(days), 30)
}

async function getStyleHeatScores() {
  const db = cloud.database()
  await ensureCollection(db, 'user_favorites')
  await ensureCollection(db, 'user_events')

  const now = Date.now()
  const cutoff = now - THIRTY_DAYS_MS

  const [events, tryLogs, favDocs, styles] = await Promise.all([
    getAll('user_events', {}),
    getAll('try_on_logs', {}),
    getAll('user_favorites', {}),
    getAll('styles', {}),
  ])

  // UV：近30天商详访问去重用户
  const uvUsers = {}   // styleId -> Set<user_id>
  // 近30天计数
  const tryMap = {}    // styleId -> 试戴完成次数
  const favMap = {}    // styleId -> 当前有效收藏数（近30天 created_at）
  // 全量最近触达时间（用于天数衰减）
  const lastTouchMap = {} // styleId -> timestamp ms

  function bumpTouch(styleId, ts) {
    if (!styleId || !ts) return
    lastTouchMap[styleId] = Math.max(lastTouchMap[styleId] || 0, ts)
  }

  events.forEach((e) => {
    const sid = e.style_id
    if (!sid) return
    const ts = toMs(e.timestamp)
    if (e.event_type === 'style_detail_view') {
      bumpTouch(sid, ts)
      if (ts >= cutoff) {
        if (!uvUsers[sid]) uvUsers[sid] = new Set()
        uvUsers[sid].add(e.user_id || 'guest')
      }
    }
  })

  tryLogs.forEach((t) => {
    const sid = t.style_id
    if (!sid) return
    const ts = toMs(t.tried_at)
    bumpTouch(sid, ts)
    if (ts >= cutoff) {
      tryMap[sid] = (tryMap[sid] || 0) + 1
    }
  })

  favDocs.forEach((f) => {
    const sid = f.style_id
    if (!sid) return
    const ts = toMs(f.created_at)
    bumpTouch(sid, ts)
    // 取消收藏会从集合删除，此处仅统计当前有效记录
    if (ts >= cutoff) {
      favMap[sid] = (favMap[sid] || 0) + 1
    }
  })

  const createdAtMap = {}
  const xhsHotIds = new Set()
  styles.forEach((s) => {
    const sid = s.id || s._id
    if (!sid) return
    createdAtMap[sid] = toMs(s.createdAt || s.created_at)
    if (s.styleSource === 'xhs-hot' || s.style_source === 'xhs-hot') {
      xhsHotIds.add(sid)
    }
  })

  const allStyleIds = new Set([
    ...Object.keys(createdAtMap),
    ...Object.keys(uvUsers),
    ...Object.keys(tryMap),
    ...Object.keys(favMap),
    ...Object.keys(lastTouchMap),
  ])

  const heatScores = {}

  allStyleIds.forEach((styleId) => {
    // 全网热款走站外 interaction_score，不参与站内热度算法
    if (xhsHotIds.has(styleId)) return
    const uv = uvUsers[styleId] ? uvUsers[styleId].size : 0
    const tryCount = tryMap[styleId] || 0
    const favCount = favMap[styleId] || 0

    const lastTouch = lastTouchMap[styleId]
    const createdAt = createdAtMap[styleId] || now
    const daysRaw = lastTouch
      ? daysSince(lastTouch, now)
      : daysSince(createdAt, now)
    const days = capDays(daysRaw)

    const base = uv * 3 + favCount * 30 + tryCount * 50
    const convBonus = uv > 0 ? (tryCount / uv) * 200 : 0
    const decay = Math.exp(-0.023 * days)

    heatScores[styleId] = Math.round((base + convBonus) * decay)
  })

  return { ok: true, heatScores }
}

module.exports = { getStyleHeatScores, toMs, capDays }
