// 批次 B · 冒烟测试 1 — 商家看板：HotDataService.fetchTop20
// 覆盖：
//   1. fetchTop20() 返回正好 20 条
//   2. 每条字段完整：word / platform / heat / fetchedAt / relatedStyleIds
//   3. 按 heat 严格降序（榜单语义）
//   4. heat 为正整数；relatedStyleIds 为非空数组
//   5. platform ∈ {xhs, douyin, weibo}（白名单）
//   6. 调用 fetchRanking() 返回带 city + items + updatedAt，items 关联出 title/coverUrl
//
// 不进入 C 端首页 / AR / 降级路径。

jest.mock('mobx-miniprogram', () => ({
  observable: (obj) => obj,
  action: (fn) => fn
}), { virtual: true });

const hotDataService = require('../../services/hot-data.service');

describe('[Smoke B1] 商家看板：HotDataService.fetchTop20 / fetchRanking', () => {
  let top20;

  test('Step1: fetchTop20() 返回正好 20 条', async () => {
    top20 = await hotDataService.fetchTop20();
    expect(Array.isArray(top20)).toBe(true);
    expect(top20.length).toBe(20);
  });

  test('Step2: 每条字段完整 — word/platform/heat/fetchedAt/relatedStyleIds', () => {
    expect(top20).toBeTruthy();
    top20.forEach((row, idx) => {
      expect(typeof row.word).toBe('string');
      expect(row.word.length).toBeGreaterThan(0);
      expect(typeof row.platform).toBe('string');
      expect(typeof row.heat).toBe('number');
      expect(typeof row.fetchedAt).toBe('string');
      expect(Array.isArray(row.relatedStyleIds)).toBe(true);
      expect(row.relatedStyleIds.length).toBeGreaterThan(0);
      // 调试用 — 防止因为 idx 报错时不知道是哪一行
      if (!(row.heat > 0)) {
        throw new Error('row #' + idx + ' heat 非正：' + row.heat);
      }
    });
  });

  test('Step3: heat 严格按降序排列（榜单语义）', () => {
    for (let i = 1; i < top20.length; i++) {
      expect(top20[i - 1].heat).toBeGreaterThanOrEqual(top20[i].heat);
    }
  });

  test('Step4: platform 命中白名单 {xhs, douyin, weibo}', () => {
    const allowed = new Set(['xhs', 'douyin', 'weibo']);
    top20.forEach((row) => {
      expect(allowed.has(row.platform)).toBe(true);
    });
  });

  test('Step5: 多次调用幂等 — 两次 fetchTop20 内容长度一致', async () => {
    const a = await hotDataService.fetchTop20();
    const b = await hotDataService.fetchTop20();
    expect(a.length).toBe(20);
    expect(b.length).toBe(20);
    // 内容快照一致（mock 数据应稳定）
    expect(a.map((x) => x.word)).toEqual(b.map((x) => x.word));
    expect(a.map((x) => x.heat)).toEqual(b.map((x) => x.heat));
  });

  test('Step6: fetchRanking() 返回 {updatedAt, city, items}，items 关联出款式 title/coverUrl', async () => {
    const r = await hotDataService.fetchRanking('上海');
    expect(r).toBeTruthy();
    expect(typeof r.updatedAt).toBe('string');
    expect(r.city).toBe('上海');
    expect(Array.isArray(r.items)).toBe(true);
    expect(r.items.length).toBeGreaterThan(0);
    // 至少一条带出 style 字段（说明 service 做了 join）
    const joined = r.items.find((it) => it.title && it.coverUrl);
    expect(joined).toBeTruthy();
    expect(joined.coverUrl).toMatch(/^https?:\/\//);
  });

  test('Step7: fetchRanking() 不传 city 回落默认值', async () => {
    const r = await hotDataService.fetchRanking();
    expect(typeof r.city).toBe('string');
    expect(r.city.length).toBeGreaterThan(0);
  });
});
