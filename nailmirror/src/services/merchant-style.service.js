const cloudUtil = require('../utils/cloud');
const imageUtil = require('../utils/image');
const { safeGet, safeSet } = require('../utils/storage');
const { STORAGE_MERCHANT_STYLES } = require('../config/constants');
const { buildDisplayTags } = require('../config/tag-vocabulary');
const { formatUploadFailure } = require('../utils/upload-validation');
const { userStore } = require('../stores/user.store');
const MERCHANT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 分钟
let _merchantCache = { styles: [], fetchedAt: 0 };

function getCachedMerchantStyles() {
  const cached = safeGet(STORAGE_MERCHANT_STYLES, []);
  return Array.isArray(cached) ? cached.filter((s) => s && s.id).map(remapCachedStyle) : [];
}

/** B 端统计用：仅返回指定商家 openid 名下的本地缓存款式 */
function getCachedMerchantStylesForMerchant(merchantId) {
  const owner = String(merchantId || '').trim();
  if (!owner) return [];
  return getCachedMerchantStyles().filter(
    (style) => style && String(style.merchantId || '').trim() === owner
  );
}

function uniqueList(items) {
  const seen = {};
  return (items || []).filter((item) => {
    if (!item || seen[item]) return false;
    seen[item] = true;
    return true;
  });
}

function isCloudFileID(value) {
  return String(value || '').indexOf('cloud://') === 0;
}

function pickCoverUrl(fileID, httpsUrl) {
  // 真机优先 cloud:// fileID，避免 HTTPS 临时链过期 403
  if (httpsUrl && !isCloudFileID(httpsUrl)) return httpsUrl;
  return fileID && !isCloudFileID(fileID) ? fileID : '';
}

function normalizeClientStyle(style) {
  if (!style) return style;
  const fileID = style.styleImageFileID || '';
  const https = [style.coverUrl, style.imageUrl, style.sourceUrl]
    .find((url) => url && !isCloudFileID(url)) || '';
  const coverUrl = pickCoverUrl(fileID, https);
  const previewUrls = style.previewUrls && style.previewUrls.length
    ? style.previewUrls.filter((url) => !isCloudFileID(url))
    : uniqueList([coverUrl, style.sourceUrl, style.imageUrl].filter((url) => !isCloudFileID(url)));
  return Object.assign({}, style, {
    coverUrl,
    sourceUrl: coverUrl || (isCloudFileID(style.sourceUrl) ? '' : style.sourceUrl),
    imageUrl: coverUrl || (isCloudFileID(style.imageUrl) ? '' : style.imageUrl),
    previewUrls,
  });
}

function remapCachedStyle(style) {
  if (!style || !style.id) return style;
  return normalizeClientStyle(style);
}

function mergeCachedMerchantStyles(styles) {
  const byId = {};
  getCachedMerchantStyles().forEach((style) => {
    byId[style.id] = style;
  });
  (styles || []).forEach((style) => {
    if (style && style.id) byId[style.id] = style;
  });
  const merged = Object.keys(byId)
    .map((id) => byId[id])
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  safeSet(STORAGE_MERCHANT_STYLES, merged);
  return merged;
}

function basename(filePath) {
  const raw = String(filePath || '');
  return raw.split(/[\\/]/).filter(Boolean).pop() || ('style-' + Date.now() + '.jpg');
}

function extname(filePath) {
  const name = basename(filePath);
  const m = name.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/);
  return (m && m[1]) ? m[1].toLowerCase() : 'jpg';
}

function uploadPathFor(localPath, index) {
  const ext = extname(localPath);
  const suffix = Date.now() + '-' + index + '-' + Math.random().toString(36).slice(2, 8);
  return 'merchant/styles/' + suffix + '.' + ext;
}

function mapCloudStyleToClientStyle(row) {
  const id = row && (row._id || row.id);
  const rankWeight = Number(row && row.rank_weight);
  const heat = Math.round((Number.isFinite(rankWeight) ? rankWeight : 1.2) * 1000);
  const color = (row && row.color) || '';
  const design = (row && row.design) || '';
  const shapeLabel = (row && (row.shape || row.shapeLabel)) || '';
  const styleLabel = (row && (row.style || row.styleLabel)) || '';
  const title = (row && (row.name || row.title)) || '商家上传款式';
  const fileID = (row && (row.image_file_id || row.styleImageFileID)) || '';
  const httpsUrl = (row && (row.image_url || row.coverUrl || row.imageUrl)) || '';
  const imageUrl = pickCoverUrl(fileID, httpsUrl);
  return normalizeClientStyle({
    id,
    title,
    name: title,
    brief: '商家上传款式',
    coverUrl: imageUrl,
    sourceUrl: imageUrl,
    imageUrl,
    styleImageFileID: fileID,
    originalName: (row && (row.original_name || row.originalName)) || '',
    color,
    design,
    shapeLabel,
    styleLabel,
    displayTags: buildDisplayTags(color, design, shapeLabel, styleLabel),
    heat,
    price: (row && row.price) || 199,
    isActive: row && row.is_active === false ? false : true,
    merchantId: (row && (row.merchant_id || row.merchantId)) || '',
    styleSource: 'merchant-upload',
    createdAt: (row && (row.created_at || row.createdAt)) || new Date().toISOString()
  });
}

async function uploadOne(localPath, index) {
  const compressed = await imageUtil.compress(localPath, 82);
  const up = await cloudUtil.uploadFile(uploadPathFor(localPath, index), compressed);
  if (!up || !up.fileID) throw new Error('uploadFile missing fileID');
  return {
    fileID: up.fileID,
    originalName: basename(localPath)
  };
}

async function uploadMerchantStyles(localPaths) {
  const paths = Array.isArray(localPaths) ? localPaths.filter(Boolean) : [];
  if (!paths.length) return { styles: [], failed: [] };
  const items = [];
  const failed = [];
  const localResults = [];

  for (let i = 0; i < paths.length; i += 1) {
    try {
      const item = await uploadOne(paths[i], i);
      items.push(item);
      localResults.push({ localPath: paths[i], originalName: item.originalName, fileID: item.fileID, status: 'uploaded' });
    } catch (e) {
      const fail = { localPath: paths[i], originalName: basename(paths[i]), error: e.message || String(e) };
      failed.push(fail);
      localResults.push(Object.assign({ status: 'failed' }, fail));
    }
  }

  if (!items.length) return { styles: [], failed, results: localResults };

  const result = await cloudUtil.callFunction('ops', {
    action: 'uploadMerchantStyles',
    role: 'b',
    merchantId: userStore.openid || '',
    items
  });
  if (result && result.error) throw new Error(result.error);

  const styles = ((result && result.styles) || []).map(mapCloudStyleToClientStyle).filter((s) => s.id);
  mergeCachedMerchantStyles(styles);
  const successByName = {};
  styles.forEach((style) => {
    if (style.originalName) successByName[style.originalName] = style;
  });
  const cloudFailedByName = {};
  ((result && result.failed) || []).forEach((item) => {
    if (item && item.originalName) cloudFailedByName[item.originalName] = item;
  });
  return {
    ok: !!(result && result.ok),
    styles,
    failed: failed.concat((result && result.failed) || []),
    results: localResults.map((item) => {
      if (item.status === 'failed') return item;
      const style = successByName[item.originalName];
      if (style) return Object.assign({}, item, { status: 'success', style });
      const cloudFail = cloudFailedByName[item.originalName];
      if (cloudFail) {
        return Object.assign({}, item, {
          status: 'failed',
          code: cloudFail.code || '',
          error: formatUploadFailure(cloudFail)
        });
      }
      return Object.assign({}, item, { status: 'failed', error: 'upload result missing' });
    })
  };
}

/**
 * 从云端拉取全部商家上传款，更新内存缓存与 localStorage。
 * 10 分钟内重复调用直接返回内存缓存（减少云端请求）。
 * 云端不可用时降级为本地 localStorage 缓存。
 */
async function ensureMerchantStyles(force) {
  const now = Date.now();
  if (!force && _merchantCache.fetchedAt && (now - _merchantCache.fetchedAt) < MERCHANT_CACHE_TTL_MS) {
    return _merchantCache.styles;
  }
  try {
    const cloudUtil = require('../utils/cloud');
    if (!cloudUtil.isCloudReady()) return getCachedMerchantStyles();
    const res = await cloudUtil.callFunction('ops', { action: 'listMerchantStyles' });
    if (res && res.ok && Array.isArray(res.styles)) {
      const mapped = res.styles.map(mapCloudStyleToClientStyle).filter((s) => s && s.id);
      mergeCachedMerchantStyles(mapped); // 同步更新 localStorage 供离线使用
      _merchantCache = { styles: mapped, fetchedAt: now };
      return mapped;
    }
  } catch (e) {
    // 网络不可用时沿用本地缓存
  }
  return getCachedMerchantStyles();
}

module.exports = {
  getCachedMerchantStyles,
  getCachedMerchantStylesForMerchant,
  mergeCachedMerchantStyles,
  mapCloudStyleToClientStyle,
  uploadMerchantStyles,
  ensureMerchantStyles,
};
