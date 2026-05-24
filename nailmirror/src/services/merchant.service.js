// MerchantService: getConfig / saveConfig
const { mockDelay } = require('../utils/request');
const { safeGet, safeSet } = require('../utils/storage');
const { STORAGE_MERCHANT } = require('../config/constants');
const seed = require('../mock/merchants');

async function getConfig(merchantId) {
  return mockDelay(() => {
    const cached = safeGet(STORAGE_MERCHANT, null);
    if (cached) return cached;
    const m = merchantId ? seed.find((x) => x.id === merchantId) : seed[0];
    if (m) safeSet(STORAGE_MERCHANT, m);
    return m || null;
  }, 100, 150);
}

async function saveConfig(cfg) {
  return mockDelay(() => {
    const cur = safeGet(STORAGE_MERCHANT, seed[0]);
    const next = Object.assign({}, cur, cfg);
    safeSet(STORAGE_MERCHANT, next);
    return { ok: true, merchant: next };
  }, 120, 180);
}

module.exports = { getConfig, saveConfig };
