// HotDataService: fetchTop20 / fetchRanking / fetchTrend
const fetcher = require('./adapters/openclaw-fetcher').default;
const featureFlags = require('../config/feature-flags');
const mockStyles = require('../mock/styles');
const realStyles = require('../mock/styles.real');

function getAllStyles() {
  if (featureFlags.USE_REAL_STYLES) {
    return realStyles.filter((s) => s.isActive !== false);
  }
  return mockStyles;
}

function buildRealRanking(city) {
  const sorted = getAllStyles().slice().sort((a, b) => (b.heat || 0) - (a.heat || 0)).slice(0, 20);
  const now = new Date();
  const updatedAt = now.getFullYear() + '-'
    + String(now.getMonth() + 1).padStart(2, '0') + '-'
    + String(now.getDate()).padStart(2, '0') + ' '
    + String(now.getHours()).padStart(2, '0') + ':'
    + String(now.getMinutes()).padStart(2, '0');
  const items = sorted.map((style, i) => ({
    styleId: style.id,
    rank: i + 1,
    heat: style.heat || 0,
    title: style.title,
    coverUrl: style.coverUrl,
    styleTags: style.styleTags || []
  }));
  return { updatedAt, city: city || '全网', items };
}

async function fetchTop20() {
  return fetcher.fetchKeywords();
}

async function fetchRanking(city) {
  if (featureFlags.USE_REAL_STYLES) {
    const { mockDelay } = require('../utils/request');
    return mockDelay(() => buildRealRanking(city), 120, 180);
  }
  const r = await fetcher.fetchRanking(city);
  const all = getAllStyles();
  const items = r.items.map((it) => {
    const style = all.find((s) => s.id === it.styleId) || null;
    return Object.assign({}, it, style ? {
      title: style.title,
      coverUrl: style.coverUrl,
      styleTags: style.styleTags
    } : {});
  });
  return { updatedAt: r.updatedAt, city: r.city, items };
}

async function fetchTrend(keyword) {
  return fetcher.fetchTrend(keyword);
}

module.exports = { fetchTop20, fetchRanking, fetchTrend };
