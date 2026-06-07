// FavoriteService: add / remove / list / has / initFromCloud / syncPendingToCloud
const { favoriteStore } = require('../stores/favorite.store');
const { EVT_NAIL_STYLE_FAVORITED, EVT_NAIL_STYLE_UNFAVORITED } = require('../config/constants');
const eventBus = require('../utils/event-bus');
const cloudUtil = require('../utils/cloud');
const { userStore } = require('../stores/user.store');
const logger = require('../utils/logger');
const featureFlags = require('../config/feature-flags');

let _inited = false;
let _identityReady = false;
let _cloudMerged = false;

function ensureInit() {
  if (!_inited) {
    favoriteStore.init();
    _inited = true;
  }
}

function _isMockOpenid(openid) {
  return !openid || String(openid).indexOf('mock-openid-') === 0;
}

async function ensureCloudIdentity() {
  if (_identityReady && userStore.openid && !_isMockOpenid(userStore.openid)) {
    return userStore.openid;
  }
  if (!cloudUtil.isCloudReady()) return '';

  if (featureFlags.USE_CLOUD_LOGIN) {
    try {
      const r = await cloudUtil.callFunction('login', { action: 'login' });
      if (r && r.code === 0 && r.data && r.data.openid) {
        userStore.setUser({
          openid: r.data.openid,
          nickname: r.data.nickname || userStore.nickname,
          avatarUrl: r.data.avatarUrl || userStore.avatarUrl,
          role: r.data.role || userStore.role || 'c',
        });
        _identityReady = true;
        return r.data.openid;
      }
    } catch (e) {
      logger.warn('[favorite] ensureCloudIdentity login fail', e.message || e);
    }
  }

  if (userStore.openid && !_isMockOpenid(userStore.openid)) {
    _identityReady = true;
    return userStore.openid;
  }
  return '';
}

async function _syncToCloud(action, styleId) {
  if (!cloudUtil.isCloudReady() || !styleId) return false;
  await ensureCloudIdentity();
  try {
    const r = await cloudUtil.callFunction('ops', { action, styleId });
    if (r && r.ok) return true;
    logger.warn('[favorite] cloud sync fail', action, styleId, r);
    return false;
  } catch (e) {
    logger.warn('[favorite] cloud sync error', action, styleId, e.message || e);
    return false;
  }
}

async function _ensureStyleCatalogFresh() {
  const merchantStyleService = require('./merchant-style.service');
  const xhsHotService = require('./xhs-hot.service');
  await Promise.all([
    merchantStyleService.ensureMerchantStyles(),
    xhsHotService.ensureXhsHotStyles(),
  ]);
}

async function add(styleId) {
  ensureInit();
  favoriteStore.add(styleId);
  eventBus.emit(EVT_NAIL_STYLE_FAVORITED, styleId);
  const ok = await _syncToCloud('addFavorite', styleId);
  if (!ok) logger.warn('[favorite] add local ok, cloud pending', styleId);
  return { ok: true, cloudSynced: ok };
}

async function remove(styleId) {
  ensureInit();
  favoriteStore.remove(styleId);
  eventBus.emit(EVT_NAIL_STYLE_UNFAVORITED, styleId);
  await _syncToCloud('removeFavorite', styleId);
  return { ok: true };
}

/** 本地收藏 id 映射为款式对象（可选跳过云端款式刷新） */
async function list(opts) {
  ensureInit();
  const skipRefresh = opts && opts.skipRefresh;
  if (!skipRefresh) {
    await _ensureStyleCatalogFresh();
  }
  const styleService = require('./style.service');
  const ids = favoriteStore.ids.slice();
  if (!ids.length) return [];
  const allStyles = styleService.getAllStyles();
  return ids.map((id) => allStyles.find((s) => s.id === id)).filter(Boolean);
}

function has(styleId) {
  ensureInit();
  return favoriteStore.has(styleId);
}

/** 将本地收藏逐条补推到云端（仅冷启动或收藏失败时调用，勿在 onShow 每次触发） */
async function syncPendingToCloud() {
  ensureInit();
  if (!cloudUtil.isCloudReady()) return;
  await ensureCloudIdentity();
  const ids = favoriteStore.ids.slice();
  await Promise.all(ids.map((id) => _syncToCloud('addFavorite', id)));
}

/** 从云端拉取收藏 id 合并到本地（不触发全量回填） */
async function mergeFromCloud() {
  ensureInit();
  if (!cloudUtil.isCloudReady() || _cloudMerged) return;
  await ensureCloudIdentity();
  try {
    const r = await cloudUtil.callFunction('ops', { action: 'listFavorites' });
    if (r && r.ok && Array.isArray(r.styleIds)) {
      r.styleIds.forEach((id) => favoriteStore.add(id));
    }
    _cloudMerged = true;
  } catch (e) {
    logger.warn('[favorite] mergeFromCloud fail', e.message || e);
  }
}

async function initFromCloud() {
  await mergeFromCloud();
}

module.exports = {
  add,
  remove,
  list,
  has,
  initFromCloud,
  mergeFromCloud,
  syncPendingToCloud,
  ensureCloudIdentity,
};
