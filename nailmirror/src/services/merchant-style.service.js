const cloudUtil = require('../utils/cloud');
const imageUtil = require('../utils/image');
const { safeGet, safeSet } = require('../utils/storage');
const { STORAGE_MERCHANT_STYLES } = require('../config/constants');
const { buildDisplayTags } = require('../config/tag-vocabulary');
const { userStore } = require('../stores/user.store');

function getCachedMerchantStyles() {
  const cached = safeGet(STORAGE_MERCHANT_STYLES, []);
  return Array.isArray(cached) ? cached.filter((s) => s && s.id).map(normalizeClientStyle) : [];
}

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
  const imageUrl = (row && (row.image_url || row.coverUrl || row.imageUrl)) || '';
  return normalizeClientStyle({
    id,
    title,
    name: title,
    brief: '商家上传款式',
    coverUrl: imageUrl,
    sourceUrl: imageUrl,
    imageUrl,
    styleImageFileID: (row && (row.image_file_id || row.styleImageFileID)) || '',
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
    merchantId: userStore.openid || userStore.nickname || 'merchant-debug',
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
      if (cloudFail) return Object.assign({}, item, { status: 'failed', error: cloudFail.error || 'VLM failed' });
      return Object.assign({}, item, { status: 'failed', error: 'upload result missing' });
    })
  };
}

module.exports = {
  getCachedMerchantStyles,
  mergeCachedMerchantStyles,
  mapCloudStyleToClientStyle,
  uploadMerchantStyles
};
