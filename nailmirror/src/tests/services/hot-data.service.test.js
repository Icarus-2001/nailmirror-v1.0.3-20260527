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
});
