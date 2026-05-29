/**
 * computeWeights — 三因子确定性调权计算
 * 对应团队文档 scoring 公式（智能运营层.md / 后端及运营优化方案0527.md）
 *
 * 三因子：
 *   热度分  (max 2.5)  近7天试戴排名线性归一化
 *   动能分  (max 1.5)  近3天 vs 前3天增速，线性映射到 0~1.5
 *   共振分  (max 1.0)  与外部趋势 color/design 有匹配则 +1.0
 *
 * newWeight = clamp(热度 + 动能 + 共振, 0.5, 5.0)
 * 只计算，不写库。
 */
const cloud = require('wx-server-sdk')
const { getAll } = require('../utils/db')

function _growthRate(count3d, prevCount3d) {
  if (prevCount3d === 0 && count3d > 0) return count3d * 100
  return ((count3d - prevCount3d) / Math.max(prevCount3d, 1)) * 100
}

async function computeWeights() {
  const db = cloud.database()
  const _ = db.command
  const now = new Date()
  const ms = (days) => days * 24 * 60 * 60 * 1000
  const threeDaysAgo    = new Date(now - ms(3))
  const sixDaysAgo      = new Date(now - ms(6))
  const sevenDaysAgo    = new Date(now - ms(7))
  const fourteenDaysAgo = new Date(now - ms(14))

  // 读取所有激活款式
  const styles = await getAll('styles', { isActive: true })
  if (styles.length === 0) return { suggestions: [], computedAt: now.toISOString() }

  // 读取近14天试戴日志
  const allLogs = await getAll('try_on_logs', { triedAt: _.gte(fourteenDaysAgo) })

  // 按款式分组
  const logsByStyle = {}
  for (const s of styles) logsByStyle[s._id] = []
  for (const log of allLogs) {
    if (logsByStyle[log.styleId] !== undefined)
      logsByStyle[log.styleId].push(new Date(log.triedAt))
  }

  // 统计窗口数
  const counts7d = {}, counts3d = {}, countsPrev3d = {}
  for (const s of styles) {
    const dates = logsByStyle[s._id] || []
    counts7d[s._id]     = dates.filter((d) => d >= sevenDaysAgo).length
    counts3d[s._id]     = dates.filter((d) => d >= threeDaysAgo).length
    countsPrev3d[s._id] = dates.filter((d) => d >= sixDaysAgo && d < threeDaysAgo).length
  }

  // 按7日数排序（用于热度排名）
  const sorted = [...styles].sort((a, b) => counts7d[b._id] - counts7d[a._id])
  const n = sorted.length

  // 读取外部趋势标签（近14天，用于共振计算）
  const trends = await getAll('external_trends', { postedAt: _.gte(fourteenDaysAgo) })
  const trendLabels = trends.map((t) => ({ color: t.color, design: t.design }))

  // 三因子计算
  const suggestions = sorted.map((s, rank) => {
    // 热度分：排名第1 → 2.5，排名最后 → 0
    const heatScore = n > 1 ? 2.5 * (1 - rank / (n - 1)) : 2.5

    // 动能分：增速映射 0~200% → 0~1.5，负增速为 0
    const growth = _growthRate(counts3d[s._id], countsPrev3d[s._id])
    const momentumScore = Math.min(1.5, Math.max(0, (growth / 200) * 1.5))

    // 共振分：外部趋势中有相同颜色或图案 → 1.0
    const hasResonance = trendLabels.some(
      (t) =>
        (t.color  && s.color  && t.color  === s.color) ||
        (t.design && s.design && t.design === s.design)
    )
    const resonanceScore = hasResonance ? 1.0 : 0

    const newWeight = +Math.min(5.0, Math.max(0.5, heatScore + momentumScore + resonanceScore)).toFixed(2)
    const oldWeight = s.rankWeight || 1.0

    return {
      styleId:        s._id,
      name:           s.title,
      oldWeight:      +oldWeight.toFixed(2),
      newWeight,
      delta:          +(newWeight - oldWeight).toFixed(2),
      factors: {
        heatScore:      +heatScore.toFixed(2),
        momentumScore:  +momentumScore.toFixed(2),
        resonanceScore: +resonanceScore.toFixed(2),
        tryCount7d:     counts7d[s._id],
        growthRate:     +growth.toFixed(1),
      },
    }
  })

  return {
    suggestions,
    computedAt: now.toISOString(),
  }
}

module.exports = { computeWeights }
