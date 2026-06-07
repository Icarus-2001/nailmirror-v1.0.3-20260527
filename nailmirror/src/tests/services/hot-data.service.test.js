jest.mock('mobx-miniprogram', () => ({ observable: (o) => o, action: (fn) => fn }), { virtual: true });

const hotDataService = require('../../services/hot-data.service');

describe('HotDataService', () => {
  test('fetchTop20 返回 20 条热词', async () => {
    const r = await hotDataService.fetchTop20();
    expect(r.length).toBe(20);
    expect(r[0]).toHaveProperty('word');
    expect(r[0]).toHaveProperty('heat');
  });

  test('fetchRanking 返回带 updatedAt', async () => {
    const r = await hotDataService.fetchRanking('北京');
    expect(r.updatedAt).toBeTruthy();
    expect(r.items.length).toBeGreaterThan(0);
  });

  test('fetchTrend 返回 7 天数据', async () => {
    const r = await hotDataService.fetchTrend('法式极简');
    expect(r.points.length).toBe(7);
  });

  test('buildSiteHotRanking 合并快照与本地款式字段', () => {
    const built = hotDataService.buildSiteHotRanking({
      rank_date: '2026-06-07',
      updated_at: '2026-06-07T10:00:00.000Z',
      items: [
        { styleId: 'real-1', rank: 1, heat: 411 },
        { styleId: 'unknown-style', rank: 2, heat: 100 },
      ],
    });
    expect(built.rankType).toBe('site');
    expect(built.items).toHaveLength(2);
    expect(built.items[0].title).toBeTruthy();
    expect(built.items[0].styleSource).toBe('platform');
    expect(built.items[0].heat).toBe(411);
    expect(built.updatedAt).toContain('站内热度 TOP10');
  });
});
