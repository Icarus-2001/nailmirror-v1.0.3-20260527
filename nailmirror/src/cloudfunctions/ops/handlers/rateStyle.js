/**
 * rateStyle — 用户评分追加写入 style_ratings
 *
 * 品质分计算逻辑（getSummary 使用）：
 *   time-decay 加权平均，半衰期 30 天
 *   weight_i = 0.5 ^ (days_ago_i / 30)
 *   quality_score = Σ(rating_i × weight_i) / Σ(weight_i)
 *
 * 每次评分都追加一条新记录，保留历史；recent 评分自动占更大权重。
 * 自定义上传款（custom- 前缀）不参与评分。
 */
const cloud = require('wx-server-sdk')

function _normalize(rating) {
  const n = Math.round(Number(rating))
  return Number.isFinite(n) ? Math.max(1, Math.min(5, n)) : 0
}

async function rateStyle({ styleId, openid, rating }) {
  if (!styleId || String(styleId).indexOf('custom-') === 0) {
    return { ok: true, skipped: true }
  }
  const normalized = _normalize(rating)
  if (!normalized) return { ok: false, error: '无效评分' }

  const db = cloud.database()
  await db.collection('style_ratings').add({
    data: {
      style_id: styleId,
      user_id:  openid || 'guest',
      rating:   normalized,
      rated_at: db.serverDate(),
    },
  })
  return { ok: true }
}

module.exports = { rateStyle }
