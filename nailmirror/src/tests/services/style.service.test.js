// 解决 mobx-miniprogram 在 jest 中的依赖问题：本地 stub
jest.mock('mobx-miniprogram', () => ({
  observable: (obj) => obj,
  action: (fn) => fn
}), { virtual: true });

const styleService = require('../../services/style.service');

describe('StyleService', () => {
  test('list 返回带分页', async () => {
    const r = await styleService.list({ page: 1, pageSize: 10 });
    expect(r.items.length).toBeLessThanOrEqual(10);
    expect(r.total).toBeGreaterThan(0);
    expect(r.page).toBe(1);
  });

  test('list 按风格筛选', async () => {
    const r = await styleService.list({ styleTags: ['cool'], page: 1, pageSize: 50 });
    expect(r.items.length).toBeGreaterThan(0);
    r.items.forEach((it) => {
      expect(it.styleTags).toContain('cool');
    });
  });

  test('get 找不到抛错', async () => {
    await expect(styleService.get('not-exist')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('search 空结果走兜底', async () => {
    const r = await styleService.search({ keyword: 'zzzzznever-match-xxx' });
    expect(r.fallback).toBe(true);
    expect(r.items.length).toBeGreaterThan(0);
  });
});
