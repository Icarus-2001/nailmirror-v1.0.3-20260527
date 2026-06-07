/**
 * 站内款式热度算法（与 getStyleHeatScores 一致）
 */
const MS_PER_DAY = 86400000
const THIRTY_DAYS_MS = 30 * MS_PER_DAY

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

function endOfDayMs(ts) {
  const d = new Date(ts)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

function startOfDayMs(ts) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function dayKey(ts) {
  const d = new Date(ts)
  return d.getFullYear() + '-'
    + String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0')
}

function formatMMDD(ts) {
  const d = new Date(ts)
  return String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0')
}

function computeHeatFromCounts(uv, tryCount, favCount, lastTouchMs, createdAtMs, nowMs) {
  const anchor = createdAtMs || nowMs
  const daysRaw = lastTouchMs
    ? daysSince(lastTouchMs, nowMs)
    : daysSince(anchor, nowMs)
  const days = capDays(daysRaw)
  const base = uv * 3 + favCount * 30 + tryCount * 50
  const convBonus = uv > 0 ? (tryCount / uv) * 200 : 0
  const decay = Math.exp(-0.023 * days)
  return Math.round((base + convBonus) * decay)
}

function linearSlope(values) {
  if (!values || values.length < 2) return 0
  const n = values.length
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0
  for (let i = 0; i < n; i += 1) {
    sumX += i
    sumY += values[i]
    sumXY += i * values[i]
    sumXX += i * i
  }
  const denom = n * sumXX - sumX * sumX
  if (!denom) return 0
  return (n * sumXY - sumX * sumY) / denom
}

function wowPercent(currentSum, prevSum) {
  const denom = Math.max(prevSum, 1)
  return +(((currentSum - prevSum) / denom) * 100).toFixed(1)
}

/**
 * 从原始行为数据构建索引（可按 styleIdSet 过滤）
 */
function buildBehaviorStore(events, tryLogs, favDocs, styleIdSet) {
  const store = {
    events: [],
    tryLogs: [],
    favDocs: [],
  }
  const inSet = (sid) => !styleIdSet || styleIdSet.has(String(sid))

  ;(events || []).forEach((e) => {
    if (!e || !e.style_id || !inSet(e.style_id)) return
    if (e.event_type !== 'style_detail_view') return
    store.events.push({
      styleId: String(e.style_id),
      userId: e.user_id || 'guest',
      ts: toMs(e.timestamp),
    })
  })

  ;(tryLogs || []).forEach((t) => {
    if (!t || !t.style_id || !inSet(t.style_id)) return
    store.tryLogs.push({
      styleId: String(t.style_id),
      ts: toMs(t.tried_at),
    })
  })

  ;(favDocs || []).forEach((f) => {
    if (!f || !f.style_id || !inSet(f.style_id)) return
    store.favDocs.push({
      styleId: String(f.style_id),
      ts: toMs(f.created_at),
    })
  })

  return store
}

function aggregateWindow(store, styleId, windowStart, windowEnd) {
  const sid = String(styleId)
  const uvSet = new Set()
  let tryCount = 0
  let favCount = 0
  let lastTouch = 0

  store.events.forEach((e) => {
    if (e.styleId !== sid) return
    if (e.ts) lastTouch = Math.max(lastTouch, e.ts)
    if (e.ts >= windowStart && e.ts <= windowEnd) uvSet.add(e.userId)
  })
  store.tryLogs.forEach((t) => {
    if (t.styleId !== sid) return
    if (t.ts) lastTouch = Math.max(lastTouch, t.ts)
    if (t.ts >= windowStart && t.ts <= windowEnd) tryCount += 1
  })
  store.favDocs.forEach((f) => {
    if (f.styleId !== sid) return
    if (f.ts) lastTouch = Math.max(lastTouch, f.ts)
    if (f.ts >= windowStart && f.ts <= windowEnd) favCount += 1
  })

  return { uv: uvSet.size, tryCount, favCount, lastTouch }
}

function computeHeatAsOf(store, styleId, createdAtMs, asOfEndMs) {
  const windowStart = asOfEndMs - THIRTY_DAYS_MS
  const agg = aggregateWindow(store, styleId, windowStart, asOfEndMs)
  return computeHeatFromCounts(
    agg.uv,
    agg.tryCount,
    agg.favCount,
    agg.lastTouch,
    createdAtMs,
    asOfEndMs,
  )
}

function buildLast7DayEnds(nowMs) {
  const ends = []
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(nowMs)
    d.setDate(d.getDate() - i)
    ends.push(endOfDayMs(d.getTime()))
  }
  return ends
}

function buildDailySeries(store, styleId, createdAtMs, dayEnds) {
  const uv = []
  const tryon = []
  const fav = []
  const heat = []
  const conversion = []

  dayEnds.forEach((endMs) => {
    const startMs = startOfDayMs(endMs)
    const dayAgg = aggregateWindow(store, styleId, startMs, endMs)
    uv.push(dayAgg.uv)
    tryon.push(dayAgg.tryCount)
    fav.push(dayAgg.favCount)
    heat.push(computeHeatAsOf(store, styleId, createdAtMs, endMs))
    conversion.push(dayAgg.uv > 0
      ? +((dayAgg.tryCount / dayAgg.uv) * 100).toFixed(1)
      : 0)
  })

  return { uv, tryon, fav, heat, conversion }
}

function classifyTrends(styleMetrics, styleCount) {
  const heats = styleMetrics.map((s) => s.heatNow).sort((a, b) => a - b)
  const median = heats.length
    ? heats[Math.floor(heats.length / 2)]
    : 0

  const ranked = styleMetrics.slice().sort((a, b) => b.heatNow - a.heatNow)
  const bottomThreshold = styleCount >= 3
    ? Math.ceil(styleCount * 0.8)
    : styleCount + 1

  const hot = []
  const cold = []

  styleMetrics.forEach((item) => {
    const series = item.heatSeries || []
    const slope = linearSlope(series)
    const first4 = series.slice(0, 4)
    const last3 = series.slice(4, 7)
    const avg = (arr) => (arr.length
      ? arr.reduce((a, b) => a + b, 0) / arr.length
      : 0)
    const early = avg(first4)
    const late = avg(last3)

    const isHot = (slope > 0 && late >= early * 1.1)
      || (item.wowHeat >= 30 && item.heatNow >= median)
    const rank = ranked.findIndex((r) => r.id === item.id) + 1
    const isCold = item.try7 === 0
      || (slope < 0 && late <= early * 0.9)
      || (styleCount >= 3 && rank >= bottomThreshold)

    if (isHot && !isCold) hot.push(item)
    else if (isCold && !isHot) cold.push(item)
  })

  hot.sort((a, b) => b.heatNow - a.heatNow)
  cold.sort((a, b) => b.heatNow - a.heatNow)
  return { hot, cold }
}

function aggregateTagHeat(styles, field) {
  const map = {}
  styles.forEach((s) => {
    const tag = (s[field] && String(s[field]).trim()) || '未分类'
    map[tag] = (map[tag] || 0) + (s.heatNow || 0)
  })
  return Object.keys(map)
    .map((tag) => ({ tag, heatSum: map[tag] }))
    .sort((a, b) => b.heatSum - a.heatSum)
}

function computeHeatScoresFromData(styles, events, tryLogs, favDocs, nowMs) {
  const xhsHotIds = new Set()
  const createdAtMap = {}
  ;(styles || []).forEach((s) => {
    const sid = String(s._id || s.id)
    if (!sid) return
    createdAtMap[sid] = toMs(s.createdAt || s.created_at)
    if (s.styleSource === 'xhs-hot' || s.style_source === 'xhs-hot') {
      xhsHotIds.add(sid)
    }
  })

  const store = buildBehaviorStore(events, tryLogs, favDocs, null)
  const allStyleIds = new Set([
    ...Object.keys(createdAtMap),
    ...store.events.map((e) => e.styleId),
    ...store.tryLogs.map((t) => t.styleId),
    ...store.favDocs.map((f) => f.styleId),
  ])

  const heatScores = {}
  allStyleIds.forEach((styleId) => {
    if (xhsHotIds.has(styleId)) return
    const windowStart = nowMs - THIRTY_DAYS_MS
    const agg = aggregateWindow(store, styleId, windowStart, nowMs)
    heatScores[styleId] = computeHeatFromCounts(
      agg.uv,
      agg.tryCount,
      agg.favCount,
      agg.lastTouch,
      createdAtMap[styleId] || nowMs,
      nowMs,
    )
  })

  return heatScores
}

module.exports = {
  MS_PER_DAY,
  THIRTY_DAYS_MS,
  toMs,
  daysSince,
  capDays,
  endOfDayMs,
  startOfDayMs,
  dayKey,
  formatMMDD,
  computeHeatFromCounts,
  linearSlope,
  wowPercent,
  buildBehaviorStore,
  aggregateWindow,
  computeHeatAsOf,
  buildLast7DayEnds,
  buildDailySeries,
  classifyTrends,
  aggregateTagHeat,
  computeHeatScoresFromData,
}
