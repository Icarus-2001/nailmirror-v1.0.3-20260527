/**
 * getQualityScores — C 端读取各款式云端双维度评分
 *
 * 返回：
 *   qualityScores      美甲品质（B 端同源）
 *   tryonEffectScores  试戴效果（仅 C 端）
 */
const cloud = require('wx-server-sdk')
const { getAll } = require('../utils/db')
const { ensureCollection } = require('../utils/collections')
const {
  buildScoresByStyle,
  RATING_TYPE_TRYON,
  RATING_TYPE_QUALITY,
} = require('../utils/qualityScore')

function _filterScores(scores, styleIds) {
  if (!Array.isArray(styleIds) || !styleIds.length) return scores
  const filtered = {}
  for (const id of styleIds) {
    if (scores[id]) filtered[id] = scores[id]
  }
  return filtered
}

async function getQualityScores({ styleIds } = {}) {
  const db = cloud.database()
  await ensureCollection(db, 'style_ratings')
  const allRatings = await getAll('style_ratings', {})
  const nowMs = Date.now()
  const qualityScores = buildScoresByStyle(allRatings, nowMs, RATING_TYPE_QUALITY)
  const tryonEffectScores = buildScoresByStyle(allRatings, nowMs, RATING_TYPE_TRYON)

  return {
    ok: true,
    qualityScores: _filterScores(qualityScores, styleIds),
    tryonEffectScores: _filterScores(tryonEffectScores, styleIds),
    // 兼容旧客户端字段
    scores: _filterScores(qualityScores, styleIds),
  }
}

module.exports = { getQualityScores }
