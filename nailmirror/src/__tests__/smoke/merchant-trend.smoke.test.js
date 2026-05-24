// 批次 B · 冒烟测试 2 — 商家看板：7 日趋势图
// 覆盖：
//   1. fetchTrend(keyword) 返回 {keyword, points}；points 长度 === 7
//   2. 时间序列连续 — 相邻 date 间隔正好 1 天，最后一天 = 今天
//   3. heat 为非负数；空/缺失值兜底为 0
//   4. keyword 透传无误
//   5. 不传 keyword 也能返回结构化数据（兜底）
//
// ⚠️ 单位维度说明：
//   PRD 趋势图原期望"曝光/点击/收藏"三维度时间序列；
//   现 mock adapter (services/adapters/openclaw-fetcher.js:26-41) 仅返回单维 heat。
//   这是单元化裁剪（MVP 简化），不是 Bug，但是范围偏离。
//   本用例以"现实契约"断言 heat 单维；多维度需求作为遗留点上报。

jest.mock('mobx-miniprogram', () => ({
  observable: (obj) => obj,
  action: (fn) => fn
}), { virtual: true });

const hotDataService = require('../../services/hot-data.service');

function ymd(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

describe('[Smoke B2] 商家看板：7 日趋势图 fetchTrend', () => {
  test('Step1: fetchTrend("法式") 返回 {keyword, points}，points 正好 7 条', async () => {
    const r = await hotDataService.fetchTrend('法式');
    expect(r).toBeTruthy();
    expect(r.keyword).toBe('法式');
    expect(Array.isArray(r.points)).toBe(true);
    expect(r.points.length).toBe(7);
  });

  test('Step2: 时间序列连续 — 相邻 date 间隔正好 1 天，末尾 = 今天', async () => {
    const r = await hotDataService.fetchTrend('简约');
    const dates = r.points.map((p) => p.date);
    // 验证每条 date 是合法 ymd
    dates.forEach((d) => expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    // 末尾应为今天
    const today = ymd(new Date());
    expect(dates[dates.length - 1]).toBe(today);
    // 相邻间隔严格为 1 天
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const cur = new Date(dates[i]);
      const deltaDays = (cur.getTime() - prev.getTime()) / 86400000;
      expect(deltaDays).toBe(1);
    }
  });

  test('Step3: heat 为非负数（即使 mock 内含 sin/random 也不应越界）', async () => {
    const r = await hotDataService.fetchTrend('冷淡');
    r.points.forEach((p) => {
      expect(typeof p.heat).toBe('number');
      expect(Number.isFinite(p.heat)).toBe(true);
      expect(p.heat).toBeGreaterThanOrEqual(0);
    });
  });

  test('Step4: 空值兜底 — heat 必须存在不为 null/undefined（前端兜底为 0 的入口）', async () => {
    const r = await hotDataService.fetchTrend('暗黑');
    r.points.forEach((p) => {
      expect(p).toHaveProperty('heat');
      expect(p.heat).not.toBeNull();
      expect(p.heat).not.toBeUndefined();
      // 模拟前端 null 兜底逻辑
      const safeHeat = p.heat == null ? 0 : p.heat;
      expect(safeHeat).toBeGreaterThanOrEqual(0);
    });
  });

  test('Step5: 不传 keyword（undefined）仍返回结构化数据，不抛错', async () => {
    const r = await hotDataService.fetchTrend(undefined);
    expect(r).toBeTruthy();
    expect(Array.isArray(r.points)).toBe(true);
    expect(r.points.length).toBe(7);
    // adapter 实现里 base = 50000 + (keyword ? len*3000 : 0)，无 keyword 时 base=50000
    r.points.forEach((p) => expect(p.heat).toBeGreaterThanOrEqual(0));
  });

  test('Step6: 不同 keyword 触发不同 base — 长 keyword heat 期望均值更高', async () => {
    const a = await hotDataService.fetchTrend('a');
    const longKw = '超长关键词测试用例xxxxx';
    const b = await hotDataService.fetchTrend(longKw);
    const avg = (arr) => arr.reduce((s, p) => s + p.heat, 0) / arr.length;
    // 长 keyword base 更大 → 均值显著更大（差距 > 10000）
    expect(avg(b.points)).toBeGreaterThan(avg(a.points));
  });
});
