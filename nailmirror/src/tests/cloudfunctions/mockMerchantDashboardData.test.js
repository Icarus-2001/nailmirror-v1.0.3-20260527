jest.mock('wx-server-sdk', () => ({
  database: jest.fn(),
}), { virtual: true });

jest.mock('../../cloudfunctions/ops/utils/db', () => ({
  getAll: jest.fn(),
}));

jest.mock('../../cloudfunctions/ops/utils/collections', () => ({
  ensureCollection: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../cloudfunctions/ops/utils/merchant', () => ({
  LEGACY_MERCHANT_OPENID: '0f8f1fb66a2408810038a63b137a2ed3',
  LEGACY_MERCHANT_PHONE: '17312270775',
  findMerchantByOpenid: jest.fn(),
  normalizeMerchantOpenid: jest.fn((id) => String(id || '').trim()),
}));

const mockWriteSnapshot = jest.fn().mockResolvedValue({
  ok: true,
  merchantOpenid: '0f8f1fb66a2408810038a63b137a2ed3',
  snapshot_date: '2026-06-06',
  dataHealth: { events7d: 10, tryOn7d: 5 },
});

jest.mock('../../cloudfunctions/ops/handlers/getMerchantDashboard', () => {
  const actual = jest.requireActual('../../cloudfunctions/ops/handlers/getMerchantDashboard');
  return Object.assign({}, actual, {
    writeMerchantDashboardSnapshot: (...args) => mockWriteSnapshot(...args),
  });
});

const {
  mockMerchantDashboardData,
  DAILY_PROFILE,
  TARGET_STYLES,
} = require('../../cloudfunctions/ops/handlers/mockMerchantDashboardData');
const { getAll } = require('../../cloudfunctions/ops/utils/db');
const { findMerchantByOpenid } = require('../../cloudfunctions/ops/utils/merchant');
const { buildMerchantDashboardPayload } = require('../../cloudfunctions/ops/handlers/getMerchantDashboard');
const {
  getDashboardAsOfMs,
  formatSnapshotDate,
} = require('../../cloudfunctions/ops/utils/styleHeat');

function makeStyles() {
  return TARGET_STYLES.map((name, idx) => ({
    _id: 'style-' + (idx + 1),
    name,
    merchant_id: '0f8f1fb66a2408810038a63b137a2ed3',
    is_active: true,
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    color: ['金属色系', '黄绿色系', '红粉色系'][idx],
    design: ['魔镜粉', '渐变', '手绘'][idx],
    style: ['日常百搭', '甜美少女', '创意小众'][idx],
  }));
}

function collectInserted(mockAdd) {
  const events = [];
  const tryons = [];
  const favs = [];
  mockAdd.mock.calls.forEach((call) => {
    const data = call[0] && call[0].data;
    if (!data) return;
    if (data.event_type === 'style_detail_view') events.push(data);
    if (data.style_id && data.tried_at) tryons.push(data);
    if (data.style_id && data.created_at && !data.event_type) favs.push(data);
  });
  return { events, tryons, favs };
}

describe('mockMerchantDashboardData', () => {
  let mockAdd;
  let mockRemove;
  let mockCollection;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAdd = jest.fn().mockResolvedValue({ _id: 'new-id' });
    mockRemove = jest.fn().mockResolvedValue({});
    mockCollection = jest.fn(() => ({
      where: jest.fn(() => ({
        limit: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ data: [] }),
        })),
      })),
      doc: jest.fn(() => ({ remove: mockRemove })),
      add: mockAdd,
    }));

    const cloud = require('wx-server-sdk');
    cloud.database.mockReturnValue({ collection: mockCollection });

    findMerchantByOpenid.mockResolvedValue({
      openid: '0f8f1fb66a2408810038a63b137a2ed3',
      phone: '17312270775',
      store_name: '测试门店',
    });
    getAll.mockImplementation((collectionName) => {
      if (collectionName === 'styles') return Promise.resolve(makeStyles());
      return Promise.resolve([]);
    });
  });

  test('rejects when target styles are missing', async () => {
    getAll.mockImplementation((collectionName) => {
      if (collectionName === 'styles') {
        return Promise.resolve([{ _id: 's1', name: '幻彩魔镜甲', is_active: true }]);
      }
      return Promise.resolve([]);
    });

    const res = await mockMerchantDashboardData({ phone: '17312270775' });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/未找全三款/);
  });

  test('inserts rising data for hot styles and zero for cold style', async () => {
    const res = await mockMerchantDashboardData({ phone: '17312270775', clearFirst: true });
    expect(res.ok).toBe(true);
    expect(res.styles).toHaveLength(3);
    expect(mockWriteSnapshot).toHaveBeenCalled();
    expect(res.snapshot && res.snapshot.ok).toBe(true);

    const cold = res.styles.find((s) => s.name === '花漾美甲');
    const hot1 = res.styles.find((s) => s.name === '幻彩魔镜甲');
    const hot2 = res.styles.find((s) => s.name === '绿意渐变');

    expect(cold.tryons).toBe(0);
    expect(cold.events).toBe(0);
    expect(hot1.tryons).toBeGreaterThan(0);
    expect(hot2.tryons).toBeGreaterThan(0);
    expect(hot1.events).toBeGreaterThan(hot2.events);

    const inserted = collectInserted(mockAdd);
    expect(inserted.tryons.filter((t) => t.style_id === 'style-3')).toHaveLength(0);
    expect(inserted.events.filter((e) => e.style_id === 'style-3')).toHaveLength(0);
    inserted.events.forEach((e) => {
      expect(typeof e.timestamp).toBe('number');
      expect(e.timestamp).toBeGreaterThan(1e12);
    });
  });

  test('generated payload yields 2 hot trends and 1 cold trend', async () => {
    const mockRes = await mockMerchantDashboardData({ phone: '17312270775', clearFirst: false });
    expect(mockRes.ok).toBe(true);

    const inserted = collectInserted(mockAdd);
    const activeStyles = makeStyles();
    const asOfMs = getDashboardAsOfMs(Date.now());
    const snapshotDate = formatSnapshotDate(asOfMs);

    const payload = buildMerchantDashboardPayload({
      activeStyles,
      events: inserted.events.map((e) => ({
        style_id: e.style_id,
        event_type: e.event_type,
        user_id: e.user_id,
        timestamp: e.timestamp,
      })),
      tryLogs: inserted.tryons.map((t) => ({
        style_id: t.style_id,
        tried_at: t.tried_at,
      })),
      favDocs: inserted.favs.map((f) => ({
        style_id: f.style_id,
        created_at: f.created_at,
      })),
      asOfMs,
      snapshotDate,
    });

    const hotNames = payload.trends.hot.map((item) => item.title);
    const coldNames = payload.trends.cold.map((item) => item.title);

    expect(hotNames).toContain('幻彩魔镜甲');
    expect(hotNames).toContain('绿意渐变');
    expect(coldNames).toContain('花漾美甲');
    expect(payload.overview.dates).toHaveLength(7);
    expect(payload.overview.seriesByStyle['style-1'].uv[6]).toBeGreaterThan(
      payload.overview.seriesByStyle['style-1'].uv[0]
    );
  });

  test('daily profile has 7 days per style', () => {
    TARGET_STYLES.forEach((name) => {
      expect(DAILY_PROFILE[name]).toHaveLength(7);
    });
  });
});
