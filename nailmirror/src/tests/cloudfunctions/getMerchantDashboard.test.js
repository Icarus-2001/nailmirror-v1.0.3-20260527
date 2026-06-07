jest.mock('wx-server-sdk', () => ({
  getTempFileURL: jest.fn().mockResolvedValue({ fileList: [] }),
}), { virtual: true });

jest.mock('../../cloudfunctions/ops/utils/db', () => ({
  getAll: jest.fn(),
}));

jest.mock('../../cloudfunctions/ops/handlers/listMerchantOwnStyles', () => ({
  listMerchantOwnStyles: jest.fn(),
}));

const MS_DAY = 86400000;

function daysAgo(n) {
  return new Date(Date.now() - n * MS_DAY).toISOString();
}

describe('getMerchantDashboard cloud handler', () => {
  let getMerchantDashboard;
  let getAll;
  let listMerchantOwnStyles;

  beforeEach(() => {
    jest.resetModules();
    getAll = require('../../cloudfunctions/ops/utils/db').getAll;
    listMerchantOwnStyles = require('../../cloudfunctions/ops/handlers/listMerchantOwnStyles').listMerchantOwnStyles;
    getAll.mockReset();
    listMerchantOwnStyles.mockReset();
    getMerchantDashboard = require('../../cloudfunctions/ops/handlers/getMerchantDashboard').getMerchantDashboard;
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
    for (let d = 0; d < 7; d += 1) {
      const factor = d + 1;
      events.push({
        style_id: 'hot-1',
        event_type: 'style_detail_view',
        user_id: 'u' + d,
        timestamp: daysAgo(6 - d),
      });
      for (let i = 0; i < factor; i += 1) {
        tryLogs.push({ style_id: 'hot-1', tried_at: daysAgo(6 - d) });
      }
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
    expect(res.styles).toHaveLength(3);
    expect(res.overview.dates).toHaveLength(7);
    expect(res.overview.defaultSelectedIds.length).toBeLessThanOrEqual(3);
    expect(res.overview.seriesByStyle['hot-1'].uv.length).toBe(7);
    expect(res.dataHealth.hasRecentData).toBe(true);
    expect(res.tagAnalysis.color.some((t) => t.tag === '红粉色系')).toBe(true);

    const hotIds = res.trends.hot.map((i) => i.styleId);
    const coldIds = res.trends.cold.map((i) => i.styleId);
    const overlap = hotIds.filter((id) => coldIds.includes(id));
    expect(overlap).toHaveLength(0);
    expect(coldIds).toContain('cold-1');
  });
});
