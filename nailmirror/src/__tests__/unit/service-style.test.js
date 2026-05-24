// C2 单测：services/style.service.js — list / get / search

describe('services/style', () => {
  let styleService;

  beforeEach(() => {
    jest.resetModules();
    styleService = require('../../services/style.service');
  });

  test('list 默认返回首页 20 条，total = 64（mock 数据 8 风格×8）', async () => {
    const r = await styleService.list();
    expect(r.items).toHaveLength(20);
    expect(r.total).toBe(64);
    expect(r.page).toBe(1);
  });

  test('按 styleTags 过滤 french → 命中 8 条', async () => {
    const r = await styleService.list({ styleTags: ['french'], pageSize: 50 });
    expect(r.total).toBe(8);
    expect(r.items.every((it) => it.styleTags.indexOf('french') > -1)).toBe(true);
  });

  test('按 styleTags 多 tag 取并集（some 语义）：cool + glitter → 16 条', async () => {
    const r = await styleService.list({ styleTags: ['cool', 'glitter'], pageSize: 50 });
    expect(r.total).toBe(16);
    expect(
      r.items.every(
        (it) => it.styleTags.indexOf('cool') > -1 || it.styleTags.indexOf('glitter') > -1
      )
    ).toBe(true);
  });

  test('按 materialTags 过滤 matte → 命中 22 条', async () => {
    const r = await styleService.list({ materialTags: ['matte'], pageSize: 50 });
    expect(r.total).toBe(22);
    expect(r.items.every((it) => it.materialTags.indexOf('matte') > -1)).toBe(true);
  });

  test('分页：page=2 返回第 21~40 条，total 不变', async () => {
    const p1 = await styleService.list({ page: 1 });
    const p2 = await styleService.list({ page: 2 });
    expect(p2.page).toBe(2);
    expect(p2.total).toBe(64);
    expect(p2.items).toHaveLength(20);
    // p1/p2 不重叠
    const p1Ids = new Set(p1.items.map((x) => x.id));
    expect(p2.items.every((x) => !p1Ids.has(x.id))).toBe(true);
  });

  test('get 命中：传已知 id 返回款式对象', async () => {
    const r = await styleService.get('cool-01');
    expect(r).toBeDefined();
    expect(r.id).toBe('cool-01');
  });

  test('get 未命中：抛 NOT_FOUND 错误', async () => {
    await expect(styleService.get('does-not-exist')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });

  test('search 关键词命中 styleTag → 返回结果且非 fallback', async () => {
    const r = await styleService.search({ keyword: 'french' });
    expect(r.fallback).toBe(false);
    expect(r.items.length).toBeGreaterThan(0);
  });

  test('search 完全不命中 → 返回热度 TOP10 fallback', async () => {
    const r = await styleService.search({ keyword: 'zzzz-impossible-keyword-xyz' });
    expect(r.fallback).toBe(true);
    expect(r.items).toHaveLength(10);
    // 按 heat 降序
    for (let i = 1; i < r.items.length; i++) {
      expect(r.items[i - 1].heat).toBeGreaterThanOrEqual(r.items[i].heat);
    }
  });
});
