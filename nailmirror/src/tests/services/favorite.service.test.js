jest.mock('mobx-miniprogram', () => ({ observable: (o) => o, action: (fn) => fn }), { virtual: true });

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
    await favoriteService.add('french-01');
    expect(favoriteService.has('french-01')).toBe(true);
    const list = await favoriteService.list();
    expect(list.find((s) => s.id === 'french-01')).toBeTruthy();
    await favoriteService.remove('french-01');
    expect(favoriteService.has('french-01')).toBe(false);
  });
});
