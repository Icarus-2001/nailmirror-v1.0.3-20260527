/**
 * rateStyle — 用户评分追加写入 style_ratings
 *
 * rating_type:
 *   tryon_effect  试戴效果（仅 C 端展示）
 *   nail_quality  美甲品质（B 端 getSummary 品质分）
 *
 * 半星步进 1.0–5.0；每次评分追加一条新记录。
 */
const cloud = require('wx-server-sdk')
const {
  normalizeRating,
  RATING_TYPE_TRYON,
  RATING_TYPE_QUALITY,
} = require('../utils/qualityScore')
const { ensureCollection } = require('../utils/collections')

const VALID_TYPES = new Set([RATING_TYPE_TRYON, RATING_TYPE_QUALITY])

async function rateStyle({ styleId, openid, rating, ratingType }) {
  if (!styleId || String(styleId).indexOf('custom-') === 0) {
    return { ok: true, skipped: true }
  }
  const normalized = normalizeRating(rating)
  if (!normalized) return { ok: false, error: '无效评分' }

  const type = VALID_TYPES.has(ratingType) ? ratingType : RATING_TYPE_QUALITY

  const db = cloud.database()
  await ensureCollection(db, 'style_ratings')
  await db.collection('style_ratings').add({
    data: {
      style_id: styleId,
      user_id: openid || 'guest',
      rating: normalized,
      rating_type: type,
      rated_at: db.serverDate(),
    },
  })
  return { ok: true }
}

module.exports = { rateStyle }
