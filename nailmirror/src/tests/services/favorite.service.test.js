jest.mock('mobx-miniprogram', () => ({ observable: (o) => o, action: (fn) => fn }), { virtual: true });

const realStyles = require('../../mock/styles.real');
const SAMPLE_STYLE_ID = realStyles[0] && realStyles[0].id;

// 由于 favorite store/service 共用模块缓存，重置 require
describe('FavoriteService', () => {
  let favoriteService;
  let favoriteStore;
  beforeEach(() => {
    jest.resetModules();
    favoriteService = require('../../services/favorite.service');
    favoriteStore = require('../../stores/favorite.store').favoriteStore;
    if (typeof favoriteStore.setIds === 'function') favoriteStore.setIds([]);
    else favoriteStore.ids = [];
  });

  test('add / has / list / remove 全流程', async () => {
    await favoriteService.add(SAMPLE_STYLE_ID);
    expect(favoriteService.has(SAMPLE_STYLE_ID)).toBe(true);
    const list = await favoriteService.list();
    expect(list.find((s) => s.id === SAMPLE_STYLE_ID)).toBeTruthy();
    await favoriteService.remove(SAMPLE_STYLE_ID);
    expect(favoriteService.has(SAMPLE_STYLE_ID)).toBe(false);
  });

  test('未显式 init 时 has/list 仍能从 storage 读取', () => {
    const { safeSet } = require('../../utils/storage');
    const { STORAGE_FAVORITES } = require('../../config/constants');
    safeSet(STORAGE_FAVORITES, [SAMPLE_STYLE_ID]);
    expect(favoriteService.has(SAMPLE_STYLE_ID)).toBe(true);
  });
});
