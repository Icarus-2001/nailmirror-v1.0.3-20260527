// StyleService: list / get / search
const { mockDelay, makeError } = require('../utils/request');
const { PAGE_SIZE } = require('../config/constants');
const ERR = require('../config/error-codes');
const featureFlags = require('../config/feature-flags');
const mockStyles = require('../mock/styles');
const realStyles = require('../mock/styles.real');
const ratingService = require('./rating.service');
const merchantStyleService = require('./merchant-style.service');
const xhsHotService = require('./xhs-hot.service');
const cloudUtil = require('../utils/cloud');

// ── 站内热度缓存（10 分钟 TTL）──────────────────────────────────────────────
let _heatCache = null;
let _heatCacheTs = 0;
let _heatFetched = false;
const HEAT_TTL = 10 * 60 * 1000;

async function ensureStyleHeatScores() {
  if (_heatFetched && _heatCache && Date.now() - _heatCacheTs < HEAT_TTL) {
    return { heatScores: _heatCache, fetched: true };
  }
  try {
    const r = await cloudUtil.callFunction('ops', { action: 'getStyleHeatScores' });
    if (r && r.ok && r.heatScores) {
      _heatCache = r.heatScores;
      _heatCacheTs = Date.now();
      _heatFetched = true;
      return { heatScores: _heatCache, fetched: true };
    }
  } catch (e) {
    // 云端不可用时静默降级，保留现有 heat 字段
  }
  return { heatScores: {}, fetched: false };
}

/** 将算法热度合并到款式列表（xhs-hot 款保持原 interaction_score） */
function _applyHeatScores(items, heatResult) {
  const heatScores = (heatResult && heatResult.heatScores) || {};
  const fetched = !!(heatResult && heatResult.fetched);
  if (!fetched) return items;
  return items.map(s => {
    if (s.styleSource === 'xhs-hot') return s;
    return Object.assign({}, s, { heat: heatScores[s.id] || 0 });
  });
}

function getAllStyles() {
  const base = (featureFlags.USE_REAL_STYLES
    ? realStyles.filter((s) => s.isActive !== false)
    : mockStyles
  ).map((s) => (s.styleSource ? s : Object.assign({}, s, { styleSource: 'platform' })));
  const merchantStyles = merchantStyleService.getCachedMerchantStyles()
    .filter((s) => s && s.isActive !== false);
  const xhsStyles = xhsHotService.getCachedXhsHotLibraryStyles()
    .filter((s) => s && s.id);
  const merged = base.concat(merchantStyles).concat(xhsStyles);
  if (!merged.length) return base;
  const byId = {};
  merged.forEach((style) => {
    if (style && style.id) byId[style.id] = style;
  });
  return Object.keys(byId).map((id) => byId[id]);
}

function matchListFilter(values, fieldValue) {
  if (!values || !values.length) return true;
  return values.indexOf(fieldValue) > -1;
}

function matchFilters(item, filters) {
  if (!filters) return true;
  const {
    styleTags, materialTags, shapeTags,
    color, design, styleLabel, shapeLabel,
    colors, designs, styleLabels, shapeLabels,
    styleSources
  } = filters;
  if (styleSources && styleSources.length && styleSources.indexOf(item.styleSource) < 0) return false;
  if (styleTags && styleTags.length && !styleTags.some((t) => (item.styleTags || []).indexOf(t) > -1)) return false;
  if (materialTags && materialTags.length && !materialTags.some((t) => (item.materialTags || []).indexOf(t) > -1)) return false;
  if (shapeTags && shapeTags.length && !shapeTags.some((t) => (item.shapeTags || []).indexOf(t) > -1)) return false;
  if (!matchListFilter(colors, item.color)) return false;
  if (!matchListFilter(designs, item.design)) return false;
  if (!matchListFilter(styleLabels, item.styleLabel)) return false;
  if (!matchListFilter(shapeLabels, item.shapeLabel)) return false;
  if (color && item.color !== color) return false;
  if (design && item.design !== design) return false;
  if (styleLabel && item.styleLabel !== styleLabel) return false;
  if (shapeLabel && item.shapeLabel !== shapeLabel) return false;
  return true;
}

function createdAtMs(item) {
  const t = Date.parse(item && item.createdAt);
  return Number.isFinite(t) ? t : 0;
}

function sortStyles(items, sortBy, sortOrder) {
  const by = sortBy || 'heat';
  const order = sortOrder || 'desc';
  const dir = order === 'asc' ? 1 : -1;
  return items.slice().sort((a, b) => {
    let cmp = 0;
    if (by === 'createdAt') {
      cmp = createdAtMs(a) - createdAtMs(b);
      if (cmp === 0) cmp = String(a.id || '').localeCompare(String(b.id || ''));
    } else {
      cmp = Number(a.heat || 0) - Number(b.heat || 0);
      if (cmp === 0) cmp = String(a.id || '').localeCompare(String(b.id || ''));
    }
    return cmp * dir;
  });
}

async function list(filters) {
  const { page = 1, pageSize = PAGE_SIZE, sortBy, sortOrder } = filters || {};
  return mockDelay(async () => {
    const [scoresCache, , , heatResult] = await Promise.all([
      ratingService.ensureStyleScores(),
      merchantStyleService.ensureMerchantStyles(),
      xhsHotService.ensureXhsHotStyles(),
      xhsHotService.ensureXhsHotLibraryStyles(),
      ensureStyleHeatScores(),
    ]);
    const withHeat = _applyHeatScores(getAllStyles(), heatResult);
    const filtered = withHeat.filter((s) => matchFilters(s, filters));
    const sorted = sortStyles(filtered, sortBy, sortOrder);
    const start = (page - 1) * pageSize;
    return {
      items: ratingService.withRatings(sorted.slice(start, start + pageSize), scoresCache),
      total: sorted.length,
      page
    };
  }, 120, 200);
}

async function get(id) {
  return mockDelay(async () => {
    const [scoresCache, , , heatResult] = await Promise.all([
      ratingService.ensureStyleScores(),
      merchantStyleService.ensureMerchantStyles(),
      xhsHotService.ensureXhsHotStyles(),
      xhsHotService.ensureXhsHotLibraryStyles(),
      ensureStyleHeatScores(),
    ]);
    const withHeat = _applyHeatScores(getAllStyles(), heatResult);
    const item = withHeat.find((s) => s.id === id);
    if (!item) throw makeError(ERR.NOT_FOUND, '款式不存在');
    return ratingService.withRating(item, scoresCache);
  }, 80, 150);
}

async function search(opts) {
  const { keyword = '', filters } = opts || {};
  const { sortBy, sortOrder } = filters || {};
  return mockDelay(async () => {
    const [scoresCache, , , heatResult] = await Promise.all([
      ratingService.ensureStyleScores(),
      merchantStyleService.ensureMerchantStyles(),
      xhsHotService.ensureXhsHotStyles(),
      xhsHotService.ensureXhsHotLibraryStyles(),
      ensureStyleHeatScores(),
    ]);
    const withHeat = _applyHeatScores(getAllStyles(), heatResult);
    const kw = keyword.trim().toLowerCase();
    let items = withHeat.filter((s) => matchFilters(s, filters));
    if (kw) {
      items = items.filter(
        (s) =>
          (s.title || '').toLowerCase().indexOf(kw) > -1 ||
          (s.brief || '').toLowerCase().indexOf(kw) > -1 ||
          (s.color || '').indexOf(kw) > -1 ||
          (s.design || '').indexOf(kw) > -1 ||
          (s.styleLabel || '').indexOf(kw) > -1 ||
          (s.styleTags || []).some((t) => t.indexOf(kw) > -1)
      );
    }
    if (items.length === 0) {
      const fallbackItems = sortStyles(withHeat, sortBy, sortOrder).slice(0, 10);
      return { items: ratingService.withRatings(fallbackItems, scoresCache), fallback: true };
    }
    return { items: ratingService.withRatings(sortStyles(items, sortBy, sortOrder), scoresCache), fallback: false };
  }, 150, 250);
}

function getCategories() {
  const all = getAllStyles();
  const styles = [];
  const colors = [];
  const designs = [];
  const shapes = [];
  const seen = { s: {}, c: {}, d: {}, h: {} };
  all.forEach((item) => {
    if (item.styleLabel && !seen.s[item.styleLabel]) { seen.s[item.styleLabel] = 1; styles.push(item.styleLabel); }
    if (item.color && !seen.c[item.color]) { seen.c[item.color] = 1; colors.push(item.color); }
    if (item.design && !seen.d[item.design]) { seen.d[item.design] = 1; designs.push(item.design); }
    if (item.shapeLabel && !seen.h[item.shapeLabel]) { seen.h[item.shapeLabel] = 1; shapes.push(item.shapeLabel); }
  });
  return { styles, colors, designs, shapes };
}

module.exports = { list, get, search, getCategories, getAllStyles, ensureStyleHeatScores, sortStyles, matchFilters };
