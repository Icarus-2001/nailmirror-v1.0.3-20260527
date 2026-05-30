// FavoriteService: add / remove / list / has
const { mockDelay } = require('../utils/request');
const { favoriteStore } = require('../stores/favorite.store');
const { EVT_NAIL_STYLE_FAVORITED, EVT_NAIL_STYLE_UNFAVORITED } = require('../config/constants');
const eventBus = require('../utils/event-bus');
const allStyles = require('../mock/styles');
const realStyles = require('../mock/styles.real');
const featureFlags = require('../config/feature-flags');

function getAllStyles() {
  if (featureFlags.USE_REAL_STYLES) return realStyles;
  return allStyles;
}

let _inited = false;
function ensureInit() {
  if (!_inited) {
    favoriteStore.init();
    _inited = true;
  }
}

async function add(styleId) {
  ensureInit();
  return mockDelay(() => {
    favoriteStore.add(styleId);
    eventBus.emit(EVT_NAIL_STYLE_FAVORITED, styleId);
    return { ok: true };
  }, 60, 100);
}

async function remove(styleId) {
  ensureInit();
  return mockDelay(() => {
    favoriteStore.remove(styleId);
    eventBus.emit(EVT_NAIL_STYLE_UNFAVORITED, styleId);
    return { ok: true };
  }, 60, 100);
}

async function list() {
  ensureInit();
  return mockDelay(() => {
    const ids = favoriteStore.ids.slice();
    const styles = getAllStyles();
    const items = ids
      .map((id) => styles.find((s) => s.id === id))
      .filter(Boolean);
    return items;
  }, 100, 150);
}

function has(styleId) {
  ensureInit();
  return favoriteStore.has(styleId);
}

module.exports = { add, remove, list, has };
