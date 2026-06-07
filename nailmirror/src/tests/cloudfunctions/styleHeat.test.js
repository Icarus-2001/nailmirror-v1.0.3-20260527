const {
  computeHeatFromCounts,
  wowPercent,
  linearSlope,
  classifyTrends,
  aggregateTagHeat,
} = require('../../cloudfunctions/ops/utils/styleHeat');

describe('styleHeat util', () => {
  test('computeHeatFromCounts matches documented formula shape', () => {
    const heat = computeHeatFromCounts(10, 5, 2, Date.now(), Date.now(), Date.now());
    expect(heat).toBeGreaterThan(0);
  });

  test('wowPercent handles zero baseline', () => {
    expect(wowPercent(5, 0)).toBe(500);
  });

  test('classifyTrends keeps hot and cold mutually exclusive', () => {
    const metrics = [
      { id: 'h1', heatNow: 100, wowHeat: 50, try7: 10, heatSeries: [10, 20, 30, 40, 50, 60, 70] },
      { id: 'c1', heatNow: 5, wowHeat: -20, try7: 0, heatSeries: [20, 18, 15, 12, 8, 5, 2] },
    ];
    const { hot, cold } = classifyTrends(metrics, 2);
    expect(hot.some((x) => x.id === 'h1')).toBe(true);
    expect(cold.some((x) => x.id === 'c1')).toBe(true);
    expect(hot.some((x) => x.id === 'c1')).toBe(false);
  });

  test('aggregateTagHeat sums by field', () => {
    const rows = aggregateTagHeat([
      { color: '红粉色系', heatNow: 10 },
      { color: '红粉色系', heatNow: 5 },
      { color: '黑色系', heatNow: 3 },
    ], 'color');
    expect(rows[0].tag).toBe('红粉色系');
    expect(rows[0].heatSum).toBe(15);
  });
});
