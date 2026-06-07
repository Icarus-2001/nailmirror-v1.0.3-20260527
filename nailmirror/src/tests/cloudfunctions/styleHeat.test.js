const {
  toMs,
  computeHeatFromCounts,
  wowPercent,
  linearSlope,
  classifyTrends,
  aggregateTagHeat,
  aggregateTagStats,
  getDashboardAsOfMs,
  buildLast7DayEndsAsOf,
  formatSnapshotDate,
  TREND_RULES,
} = require('../../cloudfunctions/ops/utils/styleHeat');

describe('styleHeat util', () => {
  test('toMs parses millisecond numbers, $date objects and ISO strings', () => {
    const ms = 1717632000000;
    expect(toMs(ms)).toBe(ms);
    expect(toMs({ $date: '2024-06-06T12:00:00.000Z' })).toBeGreaterThan(0);
    expect(toMs(new Date(ms))).toBe(ms);
    expect(toMs('2024-06-06T12:00:00.000Z')).toBeGreaterThan(0);
    expect(toMs({ getTime: () => ms })).toBe(ms);
    expect(toMs(null)).toBe(0);
  });

  test('TREND_RULES exports hot and cold copy', () => {
    expect(TREND_RULES.hotTitle).toMatch(/爆款/);
    expect(TREND_RULES.coldBody).toMatch(/零试戴/);
  });

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

  test('aggregateTagStats counts styles per tag', () => {
    const rows = aggregateTagStats([
      { color: '红粉色系', heatNow: 10 },
      { color: '红粉色系', heatNow: 5 },
      { color: '黑色系', heatNow: 3 },
    ], 'color');
    expect(rows[0].tag).toBe('红粉色系');
    expect(rows[0].styleCount).toBe(2);
    expect(rows[0].heatSum).toBe(15);
    expect(rows[1].styleCount).toBe(1);
  });

  test('getDashboardAsOfMs returns yesterday end', () => {
    const now = new Date('2026-06-07T12:00:00').getTime();
    const asOf = getDashboardAsOfMs(now);
    const d = new Date(asOf);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(6);
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
  });

  test('buildLast7DayEndsAsOf ends at asOf day not today', () => {
    const now = new Date('2026-06-07T15:00:00').getTime();
    const asOf = getDashboardAsOfMs(now);
    const ends = buildLast7DayEndsAsOf(asOf);
    expect(ends).toHaveLength(7);
    const last = new Date(ends[ends.length - 1]);
    expect(last.getDate()).toBe(6);
    const first = new Date(ends[0]);
    expect(first.getDate()).toBe(31);
  });

  test('formatSnapshotDate matches asOf calendar day', () => {
    const asOf = new Date('2026-06-06T23:59:59.999').getTime();
    expect(formatSnapshotDate(asOf)).toBe('2026-06-06');
  });
});
