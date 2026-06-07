const mockSnapshotGet = jest.fn();

jest.mock('wx-server-sdk', () => ({
  database: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: mockSnapshotGet,
      })),
    })),
  })),
}), { virtual: true });

jest.mock('../../cloudfunctions/ops/utils/db', () => ({
  getAll: jest.fn(),
}));

jest.mock('../../cloudfunctions/ops/handlers/listMerchantOwnStyles', () => ({
  listMerchantOwnStyles: jest.fn(),
}));

jest.mock('../../cloudfunctions/ops/utils/imageRefresh', () => ({
  refreshImageUrls: jest.fn((_cloud, styles) => Promise.resolve(styles || [])),
}));

const MS_DAY = 86400000;

function daysAgo(n) {
  return new Date(Date.now() - n * MS_DAY).toISOString();
}

describe('getMerchantDashboard cloud handler', () => {
  let getMerchantDashboard;
  let buildMerchantDashboardPayload;
  let getAll;
  let listMerchantOwnStyles;
  let formatSnapshotDate;
  let getDashboardAsOfMs;

  beforeEach(() => {
    jest.resetModules();
    mockSnapshotGet.mockReset();
    mockSnapshotGet.mockRejectedValue(new Error('not found'));
    getAll = require('../../cloudfunctions/ops/utils/db').getAll;
    listMerchantOwnStyles = require('../../cloudfunctions/ops/handlers/listMerchantOwnStyles').listMerchantOwnStyles;
    getAll.mockReset();
    listMerchantOwnStyles.mockReset();
    const mod = require('../../cloudfunctions/ops/handlers/getMerchantDashboard');
    getMerchantDashboard = mod.getMerchantDashboard;
    buildMerchantDashboardPayload = mod.buildMerchantDashboardPayload;
    ({ formatSnapshotDate, getDashboardAsOfMs } = require('../../cloudfunctions/ops/utils/styleHeat'));
  });

  test('rejects missing openid', async () => {
    const res = await getMerchantDashboard({});
    expect(res.ok).toBe(false);
  });

  test('returns empty when no active styles', async () => {
    listMerchantOwnStyles.mockResolvedValueOnce({
      ok: true,
      styles: [{ _id: 's1', is_active: false, name: '下架款' }],
    });
    const res = await getMerchantDashboard({ openid: 'oid-1' });
    expect(res.ok).toBe(true);
    expect(res.dataHealth.merchantStyleCount).toBe(0);
    expect(res.snapshotDate).toBeTruthy();
  });

  test('reads snapshot when snapshot_date matches T-1 and has activity', async () => {
    const expectedDate = formatSnapshotDate(getDashboardAsOfMs(Date.now()));
    const payload = {
      ok: true,
      snapshotDate: expectedDate,
      styles: [{ id: 's1', title: '快照款', heatNow: 9 }],
      overview: { dates: ['06-01'], seriesByStyle: {}, defaultSelectedIds: ['s1'] },
      dataHealth: { merchantStyleCount: 1, hasRecentData: true, events7d: 12, tryOn7d: 5 },
      trends: { hot: [], cold: [] },
      tagAnalysis: { color: [], style: [], design: [] },
    };
    mockSnapshotGet.mockResolvedValueOnce({
      data: { snapshot_date: expectedDate, payload },
    });
    listMerchantOwnStyles.mockResolvedValueOnce({
      ok: true,
      styles: [{ _id: 's1', is_active: true, name: '快照款' }],
    });

    const res = await getMerchantDashboard({ openid: 'oid-snap' });
    expect(res.fromSnapshot).toBe(true);
    expect(res.styles[0].title).toBe('快照款');
    expect(getAll).not.toHaveBeenCalled();
  });

  test('skips stale snapshot with hasRecentData but zero 7d activity', async () => {
    const expectedDate = formatSnapshotDate(getDashboardAsOfMs(Date.now()));
    mockSnapshotGet.mockResolvedValueOnce({
      data: {
        snapshot_date: expectedDate,
        payload: {
          ok: true,
          dataHealth: { merchantStyleCount: 3, hasRecentData: true, events7d: 0, tryOn7d: 0 },
          styles: [],
          overview: { dates: [], seriesByStyle: {}, defaultSelectedIds: [] },
          trends: { hot: [], cold: [] },
          tagAnalysis: { color: [], style: [], design: [] },
        },
      },
    });
    listMerchantOwnStyles.mockResolvedValueOnce({
      ok: true,
      styles: [
        { _id: 's1', is_active: true, name: '款1', created_at: daysAgo(10) },
      ],
    });
    getAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const res = await getMerchantDashboard({ openid: 'oid-stale' });
    expect(res.fromSnapshot).toBe(false);
    expect(getAll).toHaveBeenCalled();
  });

  test('skips empty snapshot and recomputes live', async () => {
    const expectedDate = formatSnapshotDate(getDashboardAsOfMs(Date.now()));
    mockSnapshotGet.mockResolvedValueOnce({
      data: {
        snapshot_date: expectedDate,
        payload: {
          ok: true,
          dataHealth: { merchantStyleCount: 3, hasRecentData: false },
          styles: [],
          overview: { dates: [], seriesByStyle: {}, defaultSelectedIds: [] },
          trends: { hot: [], cold: [] },
          tagAnalysis: { color: [], style: [], design: [] },
        },
      },
    });
    listMerchantOwnStyles.mockResolvedValueOnce({
      ok: true,
      styles: [
        { _id: 's1', is_active: true, name: '款1', created_at: daysAgo(10) },
      ],
    });
    getAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const res = await getMerchantDashboard({ openid: 'oid-live' });
    expect(res.fromSnapshot).toBe(false);
    expect(getAll).toHaveBeenCalled();
  });

  test('scopes metrics to merchant active styles and classifies trends', async () => {
    listMerchantOwnStyles.mockResolvedValueOnce({
      ok: true,
      styles: [
        { _id: 'hot-1', is_active: true, name: '爆款', color: '红粉色系', design: '纯色', style: '日常百搭', created_at: daysAgo(20) },
        { _id: 'cold-1', is_active: true, name: '冷门', color: '黑色系', design: '法式', style: '简约高级', created_at: daysAgo(25) },
        { _id: 'mid-1', is_active: true, name: '中性', color: '裸色系', design: '渐变', style: '节日派对', created_at: daysAgo(15) },
      ],
    });

    const events = [];
    const tryLogs = [];
    const favs = [];
    for (let d = 1; d <= 7; d += 1) {
      events.push({
        style_id: 'hot-1',
        event_type: 'style_detail_view',
        user_id: 'u' + d,
        timestamp: daysAgo(d),
      });
      tryLogs.push({ style_id: 'hot-1', tried_at: daysAgo(d) });
    }
    tryLogs.push({ style_id: 'mid-1', tried_at: daysAgo(2) });
    events.push({
      style_id: 'mid-1',
      event_type: 'style_detail_view',
      user_id: 'u-mid',
      timestamp: daysAgo(2),
    });

    getAll
      .mockResolvedValueOnce(events)
      .mockResolvedValueOnce(tryLogs)
      .mockResolvedValueOnce(favs);

    const res = await getMerchantDashboard({ openid: 'oid-1' });
    expect(res.ok).toBe(true);
    expect(res.fromSnapshot).toBe(false);
    expect(res.styles).toHaveLength(3);
    expect(res.overview.dates).toHaveLength(7);
    expect(res.overview.defaultSelectedIds.length).toBeLessThanOrEqual(3);
    expect(res.overview.seriesByStyle['hot-1'].uv.length).toBe(7);
    expect(res.dataHealth.hasRecentData).toBe(true);
    expect(res.snapshotDate).toBeTruthy();

    const colorTag = res.tagAnalysis.color.find((t) => t.tag === '红粉色系');
    expect(colorTag).toBeTruthy();
    expect(colorTag.styleCount).toBe(1);

    const hotIds = res.trends.hot.map((i) => i.styleId);
    const coldIds = res.trends.cold.map((i) => i.styleId);
    const overlap = hotIds.filter((id) => coldIds.includes(id));
    expect(overlap).toHaveLength(0);
    expect(coldIds).toContain('cold-1');
  });

  test('snapPayloadLooksValid requires recent activity counts', () => {
    const { snapPayloadLooksValid } = require('../../cloudfunctions/ops/handlers/getMerchantDashboard');
    expect(snapPayloadLooksValid({ dataHealth: { hasRecentData: true, events7d: 0, tryOn7d: 0 } })).toBe(false);
    expect(snapPayloadLooksValid({ dataHealth: { hasRecentData: true, events7d: 3, tryOn7d: 0 } })).toBe(true);
    expect(snapPayloadLooksValid({ dataHealth: { hasRecentData: false, events7d: 10, tryOn7d: 10 } })).toBe(false);
  });

  test('buildMerchantDashboardPayload uses T-1 tag stats', () => {
    const asOfMs = getDashboardAsOfMs(Date.now());
    const snapshotDate = formatSnapshotDate(asOfMs);
    const res = buildMerchantDashboardPayload({
      activeStyles: [
        { _id: 'a', name: 'A', color: '金属色系', created_at: daysAgo(10) },
        { _id: 'b', name: 'B', color: '金属色系', created_at: daysAgo(10) },
        { _id: 'c', name: 'C', color: '黄绿色系', created_at: daysAgo(10) },
      ],
      events: [],
      tryLogs: [],
      favDocs: [],
      asOfMs,
      snapshotDate,
    });
    const metal = res.tagAnalysis.color.find((t) => t.tag === '金属色系');
    expect(metal.styleCount).toBe(2);
    expect(res.tagAnalysis.color.find((t) => t.tag === '黄绿色系').styleCount).toBe(1);
  });
});
