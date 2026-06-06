const { safeGet, safeSet } = require('../utils/storage');
const { STORAGE_STYLE_RATINGS } = require('../config/constants');
const { buildStarDisplay } = require('../utils/star-display');

const SCORES_CACHE_TTL_MS = 5 * 60 * 1000;
const RATING_TYPE_TRYON = 'tryon_effect';
const RATING_TYPE_QUALITY = 'nail_quality';

let _scoresCache = {
  quality: {},
  tryonEffect: {},
  fetchedAt: 0,
};

function normalizeRating(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 0;
  const half = Math.round(n * 2) / 2;
  return Math.max(1, Math.min(5, half));
}

function formatScoreText(score) {
  const n = Number(score);
  if (!Number.isFinite(n) || n < 0) return '';
  return n.toFixed(1);
}

function _normalizeStoredEntry(raw) {
  if (!raw) return { tryonEffect: null, nailQuality: null };
  if (raw.rating && !raw.tryonEffect && !raw.nailQuality) {
    return {
      tryonEffect: {
        rating: normalizeRating(raw.rating),
        ratedAt: raw.ratedAt,
        source: raw.source,
      },
      nailQuality: null,
    };
  }
  return {
    tryonEffect: raw.tryonEffect || null,
    nailQuality: raw.nailQuality || null,
  };
}

function loadRatings() {
  const cached = safeGet(STORAGE_STYLE_RATINGS, null);
  if (!cached || typeof cached !== 'object') return {};
  const normalized = {};
  Object.keys(cached).forEach((styleId) => {
    normalized[styleId] = _normalizeStoredEntry(cached[styleId]);
  });
  return normalized;
}

function saveRatings(map) {
  safeSet(STORAGE_STYLE_RATINGS, map || {});
}

function _ratingKey(ratingType) {
  return ratingType === RATING_TYPE_QUALITY ? 'nailQuality' : 'tryonEffect';
}

function getUserRating(styleId, ratingType) {
  if (!styleId) return null;
  const entry = loadRatings()[styleId];
  if (!entry) return null;
  const item = entry[_ratingKey(ratingType)];
  return item && item.rating ? item : null;
}

function hasCommittedRating(styleId, ratingType) {
  return !!getUserRating(styleId, ratingType);
}

function hasAllCommittedRatings(styleId) {
  return (
    hasCommittedRating(styleId, RATING_TYPE_TRYON)
    && hasCommittedRating(styleId, RATING_TYPE_QUALITY)
  );
}

function invalidateStyleScoresCache() {
  _scoresCache.fetchedAt = 0;
}

async function ensureStyleScores(force) {
  const now = Date.now();
  if (!force && _scoresCache.fetchedAt && (now - _scoresCache.fetchedAt) < SCORES_CACHE_TTL_MS) {
    return _scoresCache;
  }
  try {
    const cloudUtil = require('../utils/cloud');
    if (!cloudUtil.isCloudReady()) return _scoresCache;
    const res = await cloudUtil.callFunction('ops', { action: 'getQualityScores' });
    if (res && typeof res === 'object') {
      _scoresCache = {
        quality: (res.qualityScores && typeof res.qualityScores === 'object') ? res.qualityScores : {},
        tryonEffect: (res.tryonEffectScores && typeof res.tryonEffectScores === 'object') ? res.tryonEffectScores : {},
        fetchedAt: now,
      };
    }
  } catch (e) {
    // 云端不可用时沿用缓存
  }
  return _scoresCache;
}

/** @deprecated 使用 ensureStyleScores */
async function ensureQualityScores(force) {
  const cache = await ensureStyleScores(force);
  return cache.quality;
}

/** 提交评分：写入本地 storage 并上报云端（仅应在用户点「提交评分」后调用） */
function commitRating(styleId, rating, source, ratingType) {
  if (!styleId || String(styleId).indexOf('custom-') === 0) return null;
  const type = ratingType === RATING_TYPE_QUALITY ? RATING_TYPE_QUALITY : RATING_TYPE_TRYON;
  const normalized = normalizeRating(rating);
  if (!normalized) return null;

  const all = loadRatings();
  const prev = all[styleId] || { tryonEffect: null, nailQuality: null };
  const record = {
    rating: normalized,
    ratedAt: new Date().toISOString(),
    source: source || 'try-on-static',
    ratingType: type,
  };
  all[styleId] = Object.assign({}, prev, {
    [_ratingKey(type)]: record,
  });
  saveRatings(all);
  invalidateStyleScoresCache();
  _pushRatingToCloud(styleId, normalized, type);
  return record;
}

/** @deprecated 使用 commitRating */
function rateStyle(styleId, rating, source, ratingType) {
  return commitRating(styleId, rating, source, ratingType);
}

function _pushRatingToCloud(styleId, normalized, ratingType) {
  try {
    const cloudUtil = require('../utils/cloud');
    const { userStore } = require('../stores/user.store');
    if (!cloudUtil.isCloudReady()) return;
    const openid = (userStore && userStore.openid) || 'guest';
    cloudUtil.callFunction('ops', {
      action: 'rateStyle',
      styleId,
      openid,
      rating: normalized,
      ratingType,
    }).catch(() => {});
  } catch (e) {
    // 云环境不可用时静默忽略
  }
}

function withRating(style, scoresCache) {
  if (!style) return style;
  const cache = scoresCache || _scoresCache;
  const qualityScore = Number((cache.quality || {})[style.id]) || 0;
  const tryonEffectScore = Number((cache.tryonEffect || {})[style.id]) || 0;
  const qualityText = formatScoreText(qualityScore);
  const tryonEffectText = formatScoreText(tryonEffectScore);
  const qualityStarDisplay = buildStarDisplay(qualityScore);

  return Object.assign({}, style, {
    qualityScore,
    qualityText,
    qualityStarDisplay,
    tryonEffectScore,
    tryonEffectText,
    ratingText: qualityText,
    ratingSource: qualityText ? 'quality' : 'none',
  });
}

function withRatings(items, scoresCache) {
  return (items || []).map((item) => withRating(item, scoresCache));
}

module.exports = {
  RATING_TYPE_TRYON,
  RATING_TYPE_QUALITY,
  normalizeRating,
  formatScoreText,
  buildStarDisplay,
  loadRatings,
  getUserRating,
  hasCommittedRating,
  hasAllCommittedRatings,
  commitRating,
  rateStyle,
  ensureStyleScores,
  ensureQualityScores,
  invalidateStyleScoresCache,
  withRating,
  withRatings,
};
