/**
 * 品质分：time-decay 加权平均，半衰期 30 天
 * weight = 0.5 ^ (days_ago / 30)
 * score = Σ(rating × weight) / Σ(weight)，保留 1 位小数
 */
const HALF_LIFE_DAYS = 30
const MS_PER_DAY = 24 * 60 * 60 * 1000

const RATING_TYPE_TRYON = 'tryon_effect'
const RATING_TYPE_QUALITY = 'nail_quality'

function normalizeRating(rating) {
  const n = Number(rating)
  if (!Number.isFinite(n) || n < 1) return 0
  const half = Math.round(n * 2) / 2
  return Math.max(1, Math.min(5, half))
}

/** 无 rating_type 的旧记录视为试戴效果分 */
function resolveRatingType(record) {
  if (record && record.rating_type === RATING_TYPE_QUALITY) return RATING_TYPE_QUALITY
  return RATING_TYPE_TRYON
}

function computeQualityScore(records, nowMs) {
  if (!records || !records.length) return 0
  let weightedSum = 0
  let totalWeight = 0
  for (const r of records) {
    const daysAgo = (nowMs - new Date(r.rated_at).getTime()) / MS_PER_DAY
    const w = Math.pow(0.5, Math.max(0, daysAgo) / HALF_LIFE_DAYS)
    weightedSum += r.rating * w
    totalWeight += w
  }
  return totalWeight > 0
    ? Math.round((weightedSum / totalWeight) * 10) / 10
    : 0
}

function buildScoresByStyle(allRatings, nowMs, ratingType) {
  const ratingsByStyle = {}
  for (const r of allRatings || []) {
    if (resolveRatingType(r) !== ratingType) continue
    if (!ratingsByStyle[r.style_id]) ratingsByStyle[r.style_id] = []
    ratingsByStyle[r.style_id].push(r)
  }
  const scores = {}
  for (const [styleId, records] of Object.entries(ratingsByStyle)) {
    const score = computeQualityScore(records, nowMs)
    if (score > 0) scores[styleId] = score
  }
  return scores
}

module.exports = {
  normalizeRating,
  resolveRatingType,
  computeQualityScore,
  buildScoresByStyle,
  RATING_TYPE_TRYON,
  RATING_TYPE_QUALITY,
  HALF_LIFE_DAYS,
  MS_PER_DAY,
}
