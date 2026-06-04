const { safeGet, safeSet } = require('../utils/storage');
const { STORAGE_STYLE_RATINGS } = require('../config/constants');

function normalizeRating(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(1, Math.min(5, Math.round(n)));
}

function hashStyle(style) {
  const key = String((style && style.id) || '') + ':' + String((style && style.heat) || 0);
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function virtualRating(style) {
  if (!style || !style.id) return 4.5;
  return Number((4.1 + (hashStyle(style) % 9) / 10).toFixed(1));
}

function loadRatings() {
  const cached = safeGet(STORAGE_STYLE_RATINGS, null);
  return cached && typeof cached === 'object' ? cached : {};
}

function saveRatings(map) {
  safeSet(STORAGE_STYLE_RATINGS, map || {});
}

function getUserRating(styleId) {
  const item = loadRatings()[styleId];
  return item && item.rating ? item : null;
}

function rateStyle(styleId, rating, source) {
  if (!styleId || String(styleId).indexOf('custom-') === 0) return null;
  const normalized = normalizeRating(rating);
  if (!normalized) return null;
  const all = loadRatings();
  const record = {
    styleId,
    rating: normalized,
    ratedAt: new Date().toISOString(),
    source: source || 'try-on-static'
  };
  all[styleId] = record;
  saveRatings(all);
  // fire-and-forget：追加一条评分记录到云端 style_ratings
  _pushRatingToCloud(styleId, normalized);
  return record;
}

/**
 * 将用户评分异步上报到云端 style_ratings，追加记录，不覆盖历史。
 * 失败静默，不影响本地保存流程。
 */
function _pushRatingToCloud(styleId, normalized) {
  try {
    const cloudUtil = require('../utils/cloud');
    const { userStore } = require('../stores/user.store');
    if (!cloudUtil.isCloudReady()) return;
    const openid = (userStore && userStore.openid) || 'guest';
    cloudUtil.callFunction('ops', {
      action:  'rateStyle',
      styleId,
      openid,
      rating:  normalized,
    }).catch(() => {});
  } catch (e) {
    // 云环境不可用时静默忽略
  }
}

function withRating(style) {
  if (!style) return style;
  const user = getUserRating(style.id);
  const rating = user ? user.rating : virtualRating(style);
  return Object.assign({}, style, {
    rating,
    ratingText: Number(rating).toFixed(1),
    userRating: user ? user.rating : 0,
    ratingSource: user ? 'user' : 'virtual'
  });
}

function withRatings(items) {
  return (items || []).map((item) => withRating(item));
}

module.exports = {
  normalizeRating,
  virtualRating,
  loadRatings,
  getUserRating,
  rateStyle,
  withRating,
  withRatings
};
