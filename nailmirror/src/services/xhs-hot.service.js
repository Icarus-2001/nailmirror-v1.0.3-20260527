const cloudUtil = require('../utils/cloud');
const { safeGet, safeSet } = require('../utils/storage');
const { STORAGE_XHS_HOT_STYLES } = require('../config/constants');
const { buildDisplayTags } = require('../config/tag-vocabulary');

const XHS_CACHE_TTL_MS = 10 * 60 * 1000;
let _xhsCache = { styles: [], scrapeDate: '', fetchedAt: 0 };

function uniqueList(items) {
  const seen = {};
  return (items || []).filter((item) => {
    if (!item || seen[item]) return false;
    seen[item] = true;
    return true;
  });
}

function normalizeClientStyle(style) {
  if (!style) return style;
  const previewUrls = style.previewUrls && style.previewUrls.length
    ? style.previewUrls
    : uniqueList([style.coverUrl, style.sourceUrl, style.imageUrl]);
  return Object.assign({}, style, { previewUrls });
}

function getCachedXhsHotStyles() {
  const cached = safeGet(STORAGE_XHS_HOT_STYLES, null);
  const styles = cached && Array.isArray(cached.styles) ? cached.styles : [];
  return styles.filter((s) => s && s.id).map(normalizeClientStyle);
}

function getCachedScrapeDate() {
  const cached = safeGet(STORAGE_XHS_HOT_STYLES, null);
  return (cached && cached.scrapeDate) || _xhsCache.scrapeDate || '';
}

function mergeCachedXhsHotStyles(styles, scrapeDate) {
  const mapped = (styles || []).map(mapCloudStyleToClientStyle).filter((s) => s && s.id);
  const payload = {
    scrapeDate: scrapeDate || getCachedScrapeDate(),
    styles: mapped,
    updatedAt: new Date().toISOString()
  };
  safeSet(STORAGE_XHS_HOT_STYLES, payload);
  _xhsCache = { styles: mapped, scrapeDate: payload.scrapeDate, fetchedAt: Date.now() };
  return mapped;
}

function mapCloudStyleToClientStyle(row) {
  const id = row && (row._id || row.id);
  const interactionScore = Number(row && row.interaction_score) || 0;
  const rankWeight = Number(row && row.rank_weight);
  const heat = interactionScore > 0
    ? interactionScore
    : Math.round((Number.isFinite(rankWeight) ? rankWeight : 1.2) * 1000);
  const color = (row && row.color) || '';
  const design = (row && row.design) || '';
  const shapeLabel = (row && (row.shape || row.shapeLabel)) || '';
  const styleLabel = (row && (row.style || row.styleLabel)) || '';
  const title = (row && (row.name || row.title)) || '小红书热款';
  const imageUrl = (row && (row.image_url || row.coverUrl || row.imageUrl)) || '';
  const scrapeDate = (row && (row.scrape_date || row.scrapeDate)) || '';
  return normalizeClientStyle({
    id,
    title,
    name: title,
    brief: scrapeDate ? (scrapeDate + ' 小红书全网热款') : '小红书全网热款',
    coverUrl: imageUrl,
    sourceUrl: imageUrl,
    imageUrl,
    styleImageFileID: (row && (row.image_file_id || row.styleImageFileID)) || '',
    color,
    design,
    shapeLabel,
    styleLabel,
    displayTags: buildDisplayTags(color, design, shapeLabel, styleLabel),
    heat,
    rankWeight: Number.isFinite(rankWeight) ? rankWeight : heat / 1000,
    isActive: row && row.is_active === false ? false : true,
    styleSource: 'xhs-hot',
    xhsRank: Number(row && row.xhs_rank) || 0,
    scrapeDate,
    noteId: (row && (row.note_id || row.noteId)) || '',
    noteUrl: (row && (row.note_url || row.noteUrl)) || '',
    interactionScore: heat,
    createdAt: (row && (row.created_at || row.createdAt)) || ''
  });
}

async function ensureXhsHotStyles(force) {
  const now = Date.now();
  if (!force && _xhsCache.fetchedAt && (now - _xhsCache.fetchedAt) < XHS_CACHE_TTL_MS) {
    return _xhsCache.styles;
  }
  try {
    if (!cloudUtil.isCloudReady()) return getCachedXhsHotStyles();
    const res = await cloudUtil.callFunction('ops', { action: 'listXhsHotStyles' });
    if (res && res.ok && Array.isArray(res.styles)) {
      return mergeCachedXhsHotStyles(res.styles, res.scrapeDate || '');
    }
  } catch (e) {
    // 降级本地缓存
  }
  return getCachedXhsHotStyles();
}

function getMeta() {
  return {
    scrapeDate: _xhsCache.scrapeDate || getCachedScrapeDate()
  };
}

module.exports = {
  getCachedXhsHotStyles,
  getCachedScrapeDate,
  mergeCachedXhsHotStyles,
  mapCloudStyleToClientStyle,
  ensureXhsHotStyles,
  getMeta
};
