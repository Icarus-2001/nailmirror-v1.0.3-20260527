// HistoryService: list / append / reGenerate / remove
const { mockDelay, makeError } = require('../utils/request');
const { safeGet, safeSet } = require('../utils/storage');
const { STORAGE_HISTORIES, EVT_TRY_ON_HISTORY_APPENDED } = require('../config/constants');
const eventBus = require('../utils/event-bus');
const ERR = require('../config/error-codes');
const seed = require('../mock/histories');

function _loadAll() {
  const cached = safeGet(STORAGE_HISTORIES, null);
  if (cached && Array.isArray(cached)) return cached.slice();
  // 首次用 seed 写入
  safeSet(STORAGE_HISTORIES, seed);
  return seed.slice();
}

async function list() {
  return mockDelay(() => _loadAll().sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)), 100, 150);
}

async function append(record) {
  return mockDelay(() => {
    const all = _loadAll();
    const now = new Date();
    const id = 'h-' + now.getTime();
    const r = Object.assign({ id, createdAt: now.toISOString() }, record);
    all.unshift(r);
    safeSet(STORAGE_HISTORIES, all);
    eventBus.emit(EVT_TRY_ON_HISTORY_APPENDED, r);
    return { ok: true, id };
  }, 60, 100);
}

async function reGenerate(id) {
  return mockDelay(() => {
    const all = _loadAll();
    const h = all.find((x) => x.id === id);
    if (!h) throw makeError(ERR.NOT_FOUND, '历史不存在');
    const hdUrl = 'https://picsum.photos/seed/' + h.styleId + '-hd-regen-' + id + '/2000/2666';
    return { hdUrl };
  }, 3500, 4500);
}

async function remove(id) {
  return mockDelay(() => {
    const all = _loadAll().filter((x) => x.id !== id);
    safeSet(STORAGE_HISTORIES, all);
    return { ok: true };
  }, 60, 100);
}

module.exports = { list, append, reGenerate, remove };
