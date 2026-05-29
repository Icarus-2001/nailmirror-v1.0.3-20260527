/**
 * getSummary — 运营数据快照
 * 对应 Python: app/routers/dashboard.py _build_dashboard_summary()
 *              + app/services/summary.py build_summary_data()
 *
 * 返回：
 *   snapshotTime   ISO 时间戳
 *   hotStyles      近7天试戴TOP5
 *   trendingUp     近3天增速≥50%且试戴≥3次
 *   coldStyles     近7天0次试戴的款式
 *   externalHot    近14天外部趋势TOP3（小红书/抖音）
 */
const cloud = require('wx-server-sdk')
const { getAll } = require('../utils/db')

function _computeGrowthRate(count3d, prevCount3d) {
  if (prevCount3d === 0 && count3d > 0) return +(count3d * 100).toFixed(1)
  return +((((count3d - prevCount3d) / Math.max(prevCount3d, 1)) * 100).toFixed(1))
}

async function getSummary() {
  const db = cloud.database()
  const now = new Date()
  const ms = (days) => days * 24 * 60 * 60 * 1000
  const threeDaysAgo  = new Date(now - ms(3))
  const sixDaysAgo    = new Date(now - ms(6))
  const sevenDaysAgo  = new Date(now - ms(7))
  const fourteenDaysAgo = new Date(now - ms(14))

  // 1. 读取所有激活款式
  const styles = await getAll('styles', { isActive: true })
  const styleIds = styles.map((s) => s._id)

  if (styleIds.length === 0) {
    return {
      snapshotTime: now.toISOString(),
      hotStyles: [],
      trendingUp: [],
      coldStyles: [],
      externalHot: { xiaohongshu: [], douyin: [] },
    }
  }

  // 2. 读取近14天内试戴日志（涵盖所有子窗口）
  const _ = db.command
  const allLogs = await getAll('try_on_logs', {
    triedAt: _.gte(fourteenDaysAgo),
  })

  // 3. 按款式分组
  const logsByStyle = {}
  for (const s of styles) logsByStyle[s._id] = []
  for (const log of allLogs) {
    if (logsByStyle[log.styleId] !== undefined) {
      logsByStyle[log.styleId].push(new Date(log.triedAt))
    }
  }

  // 4. 计算各窗口试戴数 & 最后试戴时间
  const counts7d = {}, counts3d = {}, countsPrev3d = {}, lastTried = {}
  for (const s of styles) {
    const dates = logsByStyle[s._id] || []
    counts7d[s._id]     = dates.filter((d) => d >= sevenDaysAgo).length
    counts3d[s._id]     = dates.filter((d) => d >= threeDaysAgo).length
    countsPrev3d[s._id] = dates.filter((d) => d >= sixDaysAgo && d < threeDaysAgo).length
    const sorted = [...dates].sort((a, b) => b - a)
    lastTried[s._id] = sorted.length > 0 ? sorted[0].toISOString() : null
  }

  // 5. 热款 TOP5（按7日试戴降序）
  const hotStyles = [...styles]
    .sort((a, b) => counts7d[b._id] - counts7d[a._id])
    .slice(0, 5)
    .map((s) => ({
      styleId:       s._id,
      name:          s.title,
      color:         s.color,
      design:        s.design,
      shape:         s.shape,
      tryCount7d:    counts7d[s._id],
      tryCount3d:    counts3d[s._id],
      growthRate:    _computeGrowthRate(counts3d[s._id], countsPrev3d[s._id]),
    }))

  // 6. 飙升款（近3天≥3次 且增速≥50%）
  const trendingUp = styles
    .filter((s) => counts3d[s._id] >= 3)
    .map((s) => {
      const growth = _computeGrowthRate(counts3d[s._id], countsPrev3d[s._id])
      return {
        styleId:     s._id,
        name:        s.title,
        color:       s.color,
        design:      s.design,
        tryCount3d:  counts3d[s._id],
        growthRate:  growth,
        trendSignal: growth >= 200 ? 'rapidly_rising' : 'rising',
      }
    })
    .filter((s) => s.growthRate >= 50)
    .sort((a, b) => b.growthRate - a.growthRate)
    .slice(0, 5)

  // 7. 冷款（近7天0次试戴）
  const coldStyles = styles
    .filter((s) => counts7d[s._id] === 0)
    .map((s) => ({
      styleId:     s._id,
      name:        s.title,
      design:      s.design,
      color:       s.color,
      tryCount7d:  0,
      lastTriedAt: lastTried[s._id],
    }))

  // 8. 外部趋势 TOP3（近14天，按互动量降序）
  const trends = await getAll('external_trends', {
    postedAt: _.gte(fourteenDaysAgo),
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
        postedAt:   t.postedAt ? new Date(t.postedAt).toISOString() : null,
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
