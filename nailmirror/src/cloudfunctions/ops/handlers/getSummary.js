/**
 * getSummary — 运营数据快照
 *
 * 返回：
 *   snapshotTime   ISO 时间戳
 *   hotStyles      近7天试戴TOP5（含 qualityScore）
 *   trendingUp     近3天增速≥50%且试戴≥3次（含 qualityScore）
 *   coldStyles     近7天0次试戴的款式
 *   externalHot    近14天外部趋势TOP3（小红书/抖音）
 *
 * 品质分算法：time-decay 加权平均，半衰期 30 天
 *   weight_i = 0.5 ^ (days_ago_i / 30)
 *   quality_score = Σ(rating_i × w_i) / Σ(w_i)，保留1位小数；无评分返回 0
 */
const cloud = require('wx-server-sdk')
const { getAll } = require('../utils/db')

// ─── 品质分计算 ───────────────────────────────────────────────────────────────

const HALF_LIFE_DAYS = 30
const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * 对某款的所有评分记录计算时间衰减加权平均分
 * @param {Array} records  style_ratings 中该款的记录数组
 * @param {number} nowMs   当前时间毫秒（统一基准）
 * @returns {number} 0~5，保留1位小数；无记录返回 0
 */
function _qualityScore(records, nowMs) {
  if (!records || !records.length) return 0
  let weightedSum = 0
  let totalWeight = 0
  for (const r of records) {
    const daysAgo = (nowMs - new Date(r.rated_at).getTime()) / MS_PER_DAY
    // 0.5^(daysAgo/30)：30天前的评分权重减半，90天前权重降至 0.5^3 ≈ 0.125
    const w = Math.pow(0.5, Math.max(0, daysAgo) / HALF_LIFE_DAYS)
    weightedSum += r.rating * w
    totalWeight += w
  }
  return totalWeight > 0
    ? Math.round((weightedSum / totalWeight) * 10) / 10
    : 0
}

// ─── 热款 / 冷款辅助 ─────────────────────────────────────────────────────────

function _computeGrowthRate(count3d, prevCount3d) {
  if (prevCount3d === 0 && count3d > 0) return +(count3d * 100).toFixed(1)
  return +((((count3d - prevCount3d) / Math.max(prevCount3d, 1)) * 100).toFixed(1))
}

// ─── 主函数 ──────────────────────────────────────────────────────────────────

async function getSummary() {
  const db = cloud.database()
  const now = new Date()
  const nowMs = now.getTime()
  const ms = (days) => days * MS_PER_DAY
  const threeDaysAgo    = new Date(nowMs - ms(3))
  const sixDaysAgo      = new Date(nowMs - ms(6))
  const sevenDaysAgo    = new Date(nowMs - ms(7))
  const fourteenDaysAgo = new Date(nowMs - ms(14))

  // 1. 读取所有激活款式
  const styles = await getAll('styles', { is_active: true })
  const styleIds = styles.map((s) => s._id)

  if (styleIds.length === 0) {
    return {
      snapshotTime: now.toISOString(),
      hotStyles: [], trendingUp: [], coldStyles: [],
      externalHot: { xiaohongshu: [], douyin: [] },
    }
  }

  // 2. 近14天试戴日志
  const _ = db.command
  const allLogs = await getAll('try_on_logs', {
    tried_at: _.gte(fourteenDaysAgo),
  })

  // 3. 按款式分组
  const logsByStyle = {}
  for (const s of styles) logsByStyle[s._id] = []
  for (const log of allLogs) {
    if (logsByStyle[log.style_id] !== undefined) {
      logsByStyle[log.style_id].push(new Date(log.tried_at))
    }
  }

  // 4. 试戴窗口统计
  const counts7d = {}, counts3d = {}, countsPrev3d = {}, lastTried = {}
  for (const s of styles) {
    const dates = logsByStyle[s._id] || []
    counts7d[s._id]     = dates.filter((d) => d >= sevenDaysAgo).length
    counts3d[s._id]     = dates.filter((d) => d >= threeDaysAgo).length
    countsPrev3d[s._id] = dates.filter((d) => d >= sixDaysAgo && d < threeDaysAgo).length
    const sorted = [...dates].sort((a, b) => b - a)
    lastTried[s._id] = sorted.length > 0 ? sorted[0].toISOString() : null
  }

  // 5. 读取评分数据，按 style_id 分组
  const allRatings = await getAll('style_ratings', {})
  const ratingsByStyle = {}
  for (const r of allRatings) {
    if (!ratingsByStyle[r.style_id]) ratingsByStyle[r.style_id] = []
    ratingsByStyle[r.style_id].push(r)
  }

  // 6. 热款 TOP5
  const hotStyles = [...styles]
    .sort((a, b) => counts7d[b._id] - counts7d[a._id])
    .slice(0, 5)
    .map((s) => ({
      styleId:      s._id,
      name:         s.name,
      color:        s.color,
      design:       s.design,
      shape:        s.shape,
      tryCount7d:   counts7d[s._id],
      tryCount3d:   counts3d[s._id],
      growthRate:   _computeGrowthRate(counts3d[s._id], countsPrev3d[s._id]),
      qualityScore: _qualityScore(ratingsByStyle[s._id], nowMs),
    }))

  // 7. 飙升款
  const trendingUp = styles
    .filter((s) => counts3d[s._id] >= 3)
    .map((s) => {
      const growth = _computeGrowthRate(counts3d[s._id], countsPrev3d[s._id])
      return {
        styleId:      s._id,
        name:         s.name,
        color:        s.color,
        design:       s.design,
        tryCount3d:   counts3d[s._id],
        growthRate:   growth,
        trendSignal:  growth >= 200 ? 'rapidly_rising' : 'rising',
        qualityScore: _qualityScore(ratingsByStyle[s._id], nowMs),
      }
    })
    .filter((s) => s.growthRate >= 50)
    .sort((a, b) => b.growthRate - a.growthRate)
    .slice(0, 5)

  // 8. 冷款
  const coldStyles = styles
    .filter((s) => counts7d[s._id] === 0)
    .map((s) => ({
      styleId:      s._id,
      name:         s.name,
      design:       s.design,
      color:        s.color,
      tryCount7d:   0,
      lastTriedAt:  lastTried[s._id],
      qualityScore: _qualityScore(ratingsByStyle[s._id], nowMs),
    }))

  // 9. 外部趋势 TOP3
  const trends = await getAll('external_trends', {
    posted_at: _.gte(fourteenDaysAgo),
  })
  const topTrends = (platform) =>
    trends
      .filter((t) => t.platform === platform)
      .sort((a, b) => (b.engagement || 0) - (a.engagement || 0))
      .slice(0, 3)
      .map((t) => ({
        design:     t.design,
        color:      t.color,
        shape:      t.shape,
        engagement: t.engagement,
        postedAt:   t.posted_at ? new Date(t.posted_at).toISOString() : null,
      }))

  return {
    snapshotTime: now.toISOString(),
    hotStyles,
    trendingUp,
    coldStyles,
    externalHot: {
      xiaohongshu: topTrends('xiaohongshu'),
      douyin:      topTrends('douyin'),
    },
  }
}

module.exports = { getSummary }
