// HistoryService: list / append / reGenerate / remove（仅真实本地历史，无 mock seed）
const { mockDelay, makeError } = require('../utils/request');
const { safeGet, safeSet } = require('../utils/storage');
const { STORAGE_HISTORIES, EVT_TRY_ON_HISTORY_APPENDED } = require('../config/constants');
const eventBus = require('../utils/event-bus');
const ERR = require('../config/error-codes');
const styleService = require('./style.service');
const tryOnService = require('./try-on.service');
const { buildDisplayTags } = require('../config/tag-vocabulary');
const { formatDate } = require('../utils/formatter');
const { NAIL_SHAPES } = require('../config/enums');

const LEGACY_SEED_IDS = new Set(['h-1001', 'h-1002', 'h-1003']);

const MODE_LABELS = {
  static: '静态试戴',
  ar: 'AR 试戴',
  'ai-match': '智能搭配'
};

function _isLegacyMockEntry(item) {
  if (!item) return true;
  if (LEGACY_SEED_IDS.has(item.id)) return true;
  const urls = [item.thumbUrl, item.hdUrl].filter(Boolean).join(' ');
  if (urls.indexOf('picsum.photos') > -1) return true;
  return false;
}

function _isCustomStyleItem(item) {
  if (!item) return false;
  if (item.styleSource === 'custom-upload') return true;
  const sid = item.styleId || '';
  return String(sid).indexOf('custom-') === 0;
}

function _sortKey(createdAt) {
  const t = new Date(createdAt).getTime();
  return Number.isFinite(t) ? t : 0;
}

function _nailShapeLabel(id) {
  const s = NAIL_SHAPES.find((x) => x.id === id);
  return s ? s.label : (id || '');
}

function _resolveDisplayTags(style) {
  if (!style) return [];
  if (style.displayTags && style.displayTags.length) return style.displayTags;
  return buildDisplayTags(style.color, style.design, style.shapeLabel, style.styleLabel);
}

async function _styleFieldsFor(item) {
  if (_isCustomStyleItem(item)) {
    return {
      styleTitle: item.styleTitle || '自定义参考图',
      displayTags: (item.displayTags && item.displayTags.length)
        ? item.displayTags
        : ['上传参考图']
    };
  }
  const styleId = item && item.styleId;
  try {
    const style = await styleService.get(styleId);
    return {
      styleTitle: style.title,
      displayTags: _resolveDisplayTags(style)
    };
  } catch (e) {
    return { styleTitle: styleId || '未知款式', displayTags: [] };
  }
}

function _toViewModel(item, styleFields) {
  const modeLabel = MODE_LABELS[item.mode] || item.mode || '';
  const nailShapeLabel = _nailShapeLabel(item.nailShape);
  const createdAtText = formatDate(item.createdAt, 'YYYY-MM-DD hh:mm');
  const displayTags = item.displayTags && item.displayTags.length
    ? item.displayTags
    : (styleFields.displayTags || []);
  return Object.assign({}, item, {
    styleTitle: item.styleTitle || styleFields.styleTitle || item.styleId,
    displayTags,
    displayTagsText: displayTags.join(' · '),
    createdAtText,
    modeLabel,
    nailShapeLabel,
    metaLine: [modeLabel, nailShapeLabel, createdAtText].filter(Boolean).join(' · ')
  });
}

function _loadAll() {
  const cached = safeGet(STORAGE_HISTORIES, null);
  if (!cached || !Array.isArray(cached)) return [];
  const cleaned = cached.filter((x) => !_isLegacyMockEntry(x));
  if (cleaned.length !== cached.length) {
    safeSet(STORAGE_HISTORIES, cleaned);
  }
  return cleaned.slice();
}

async function list() {
  return mockDelay(async () => {
    const rows = _loadAll().sort((a, b) => _sortKey(b.createdAt) - _sortKey(a.createdAt));
    const enriched = await Promise.all(
      rows.map(async (item) => {
        const fields = await _styleFieldsFor(item);
        return _toViewModel(item, fields);
      })
    );
    return enriched;
  }, 100, 150);
}

async function append(record) {
  return mockDelay(async () => {
    const all = _loadAll();
    const now = new Date();
    const id = 'h-' + now.getTime();
    const styleFields = await _styleFieldsFor(record);
    const r = Object.assign(
      { id, createdAt: now.toISOString() },
      styleFields,
      record
    );
    all.unshift(r);
    safeSet(STORAGE_HISTORIES, all);
    eventBus.emit(EVT_TRY_ON_HISTORY_APPENDED, r);
    return { ok: true, id };
  }, 60, 100);
}

async function reGenerate(id) {
  const all = _loadAll();
  const h = all.find((x) => x.id === id);
  if (!h) throw makeError(ERR.NOT_FOUND, '历史不存在');
  const hd = await tryOnService.generateHD({
    styleId: h.styleId,
    sourceUrl: h.thumbUrl || h.hdUrl
  });
  h.hdUrl = hd.hdUrl;
  safeSet(STORAGE_HISTORIES, all);
  return { hdUrl: hd.hdUrl };
}

async function remove(id) {
  return mockDelay(() => {
    const all = _loadAll().filter((x) => x.id !== id);
    safeSet(STORAGE_HISTORIES, all);
    return { ok: true };
  }, 60, 100);
}

module.exports = { list, append, reGenerate, remove, _isLegacyMockEntry, _isCustomStyleItem };
