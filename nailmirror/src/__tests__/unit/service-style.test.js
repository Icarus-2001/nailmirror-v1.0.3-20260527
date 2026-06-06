describe('services/style', () => {
  let styleService;

  beforeEach(() => {
    jest.resetModules();
    styleService = require('../../services/style.service');
  });

  test('list returns first page with rating fields', async () => {
    const all = styleService.getAllStyles();
    const r = await styleService.list();
    expect(r.items).toHaveLength(Math.min(20, all.length));
    expect(r.total).toBe(all.length);
    expect(r.page).toBe(1);
    expect(r.items[0].ratingSource).toBe('none');
    expect(r.items[0].qualityText).toBe('');
    expect(r.items[0].tryonEffectText).toBe('');
  });

  test('styleTags filter matches current style data', async () => {
    const all = styleService.getAllStyles();
    const tag = all.flatMap((s) => s.styleTags || [])[0];
    const r = await styleService.list({ styleTags: [tag], pageSize: 100 });
    const expected = all.filter((it) => (it.styleTags || []).indexOf(tag) > -1);
    expect(r.total).toBe(expected.length);
    expect(r.items.every((it) => (it.styleTags || []).indexOf(tag) > -1)).toBe(true);
  });

  test('multiple styleTags use union semantics', async () => {
    const all = styleService.getAllStyles();
    const tags = Array.from(new Set(all.flatMap((s) => s.styleTags || []))).slice(0, 2);
    const r = await styleService.list({ styleTags: tags, pageSize: 100 });
    const expected = all.filter((it) => tags.some((tag) => (it.styleTags || []).indexOf(tag) > -1));
    expect(r.total).toBe(expected.length);
    expect(r.items.every((it) => tags.some((tag) => (it.styleTags || []).indexOf(tag) > -1))).toBe(true);
  });

  test('materialTags filter matches current style data when material tags exist', async () => {
    const all = styleService.getAllStyles();
    const tag = all.flatMap((s) => s.materialTags || [])[0];
    if (!tag) return;
    const r = await styleService.list({ materialTags: [tag], pageSize: 100 });
    const expected = all.filter((it) => (it.materialTags || []).indexOf(tag) > -1);
    expect(r.total).toBe(expected.length);
    expect(r.items.every((it) => (it.materialTags || []).indexOf(tag) > -1)).toBe(true);
  });

  test('pagination returns non-overlapping pages', async () => {
    const all = styleService.getAllStyles();
    const p1 = await styleService.list({ page: 1 });
    const p2 = await styleService.list({ page: 2 });
    expect(p2.page).toBe(2);
    expect(p2.total).toBe(all.length);
    expect(p2.items).toHaveLength(Math.max(0, Math.min(20, all.length - 20)));
    const p1Ids = new Set(p1.items.map((x) => x.id));
    expect(p2.items.every((x) => !p1Ids.has(x.id))).toBe(true);
  });

  test('get returns known style object', async () => {
    const first = styleService.getAllStyles()[0];
    const r = await styleService.get(first.id);
    expect(r).toBeDefined();
    expect(r.id).toBe(first.id);
    expect(r.ratingSource).toBe('none');
    expect(r.qualityText).toBe('');
    expect(r.tryonEffectText).toBe('');
  });

  test('get unknown id rejects NOT_FOUND', async () => {
    await expect(styleService.get('does-not-exist')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });

  test('search keyword hits current style data without fallback', async () => {
    const first = styleService.getAllStyles()[0];
    const keyword = first.color || first.design || first.styleLabel || first.title;
    const r = await styleService.search({ keyword });
    expect(r.fallback).toBe(false);
    expect(r.items.length).toBeGreaterThan(0);
  });

  test('search complete miss returns hot TOP10 fallback', async () => {
    const r = await styleService.search({ keyword: 'zzzz-impossible-keyword-xyz' });
    expect(r.fallback).toBe(true);
    expect(r.items).toHaveLength(10);
    for (let i = 1; i < r.items.length; i += 1) {
      expect(r.items[i - 1].heat).toBeGreaterThanOrEqual(r.items[i].heat);
    }
  });
});
