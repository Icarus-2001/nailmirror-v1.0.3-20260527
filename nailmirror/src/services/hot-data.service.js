// HotDataService: fetchTop20 / fetchRanking / fetchTrend
const fetcher = require('./adapters/openclaw-fetcher').default;
const featureFlags = require('../config/feature-flags');
const mockStyles = require('../mock/styles');
const realStyles = require('../mock/styles.real');

const PLATFORMS = ['xhs', 'douyin', 'weibo'];

function getAllStyles() {
  if (featureFlags.USE_REAL_STYLES) {
    return realStyles.filter((s) => s.isActive !== false);
  }
  return mockStyles;
}

function formatFetchedAt(date) {
  const d = date || new Date();
  return d.getFullYear() + '-'
    + String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0') + ' '
    + String(d.getHours()).padStart(2, '0') + ':'
    + String(d.getMinutes()).padStart(2, '0');
}

/** 从真实款式库聚合标准词表热词（色系 / 工艺 / 风格 / 色系·工艺） */
function buildRealHotKeywords() {
  const styles = getAllStyles();
  const fetchedAt = formatFetchedAt(new Date());
  const map = {};

  function add(word, style) {
    if (!word) return;
    if (!map[word]) {
      map[word] = { word: word, heat: 0, relatedStyleIds: [] };
    }
    map[word].heat += style.heat || 0;
    if (map[word].relatedStyleIds.indexOf(style.id) < 0) {
      map[word].relatedStyleIds.push(style.id);
    }
  }

  styles.forEach((s) => {
    add(s.color, s);
    add(s.design, s);
    add(s.styleLabel, s);
    if (s.color && s.design) add(s.color + '·' + s.design, s);
  });

  return Object.keys(map)
    .map((k) => map[k])
    .sort((a, b) => {
      if (b.heat !== a.heat) return b.heat - a.heat;
      return a.word.localeCompare(b.word, 'zh-CN');
    })
    .slice(0, 20)
    .map((item, i) => ({
      word: item.word,
      platform: PLATFORMS[i % PLATFORMS.length],
      heat: item.heat,
      fetchedAt: fetchedAt,
      relatedStyleIds: item.relatedStyleIds
    }));
}

function buildRealRanking(city) {
  const sorted = getAllStyles().slice().sort((a, b) => (b.heat || 0) - (a.heat || 0)).slice(0, 20);
  const updatedAt = formatFetchedAt(new Date());
  const items = sorted.map((style, i) => ({
    styleId: style.id,
    rank: i + 1,
    heat: style.heat || 0,
    title: style.title,
    coverUrl: style.coverUrl,
    color: style.color,
    design: style.design,
    styleTags: style.styleTags || []
  }));
  return { updatedAt, city: city || '全网', items };
}

function styleMatchesKeyword(style, keyword) {
  if (!keyword) return false;
  const combo = style.color && style.design ? style.color + '·' + style.design : '';
  return (
    style.color === keyword
    || style.design === keyword
    || style.styleLabel === keyword
    || combo === keyword
    || (style.title && style.title.indexOf(keyword) > -1)
    || (style.brief && style.brief.indexOf(keyword) > -1)
  );
}

function buildRealTrend(keyword) {
  const matched = getAllStyles().filter((s) => styleMatchesKeyword(s, keyword));
  const base = matched.reduce((sum, s) => sum + (s.heat || 0), 0) || 50000;
  const points = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    points.push({
      date: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
      heat: base + Math.floor(Math.sin(i + keyword.length) * 8000 + (6 - i) * 1200)
    });
  }
  return { keyword, points };
}

async function fetchTop20() {
  if (featureFlags.USE_REAL_STYLES) {
    const { mockDelay } = require('../utils/request');
    return mockDelay(() => buildRealHotKeywords(), 120, 180);
  }
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
  if (featureFlags.USE_REAL_STYLES) {
    const { mockDelay } = require('../utils/request');
    return mockDelay(() => buildRealTrend(keyword), 180, 220);
  }
  return fetcher.fetchTrend(keyword);
}

module.exports = {
  fetchTop20,
  fetchRanking,
  fetchTrend,
  buildRealHotKeywords
};
