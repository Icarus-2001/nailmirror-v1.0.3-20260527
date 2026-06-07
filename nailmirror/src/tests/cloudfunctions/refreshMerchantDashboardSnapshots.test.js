const mockSet = jest.fn().mockResolvedValue({});

jest.mock('wx-server-sdk', () => ({
  database: jest.fn(() => ({
    serverDate: jest.fn(() => ({ $date: Date.now() })),
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        set: mockSet,
      })),
    })),
  })),
}), { virtual: true });

jest.mock('../../cloudfunctions/ops/utils/db', () => ({
  getAll: jest.fn(),
}));

jest.mock('../../cloudfunctions/ops/utils/collections', () => ({
  ensureCollection: jest.fn().mockResolvedValue({}),
}));

const { refreshMerchantDashboardSnapshots } = require('../../cloudfunctions/ops/handlers/refreshMerchantDashboardSnapshots');
const { getAll } = require('../../cloudfunctions/ops/utils/db');
const { formatSnapshotDate, getDashboardAsOfMs } = require('../../cloudfunctions/ops/utils/styleHeat');

describe('refreshMerchantDashboardSnapshots', () => {
  beforeEach(() => {
    mockSet.mockClear();
    getAll.mockReset();
  });

  test('writes one snapshot per merchant', async () => {
    getAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { _id: 's1', merchant_id: 'm1', name: '款1', is_active: true, created_at: new Date().toISOString() },
        { _id: 's2', merchant_id: 'm1', name: '款2', is_active: true, created_at: new Date().toISOString() },
        { _id: 's3', merchant_id: 'm2', name: '款3', is_active: true, created_at: new Date().toISOString() },
      ]);

    const res = await refreshMerchantDashboardSnapshots();
    const expectedDate = formatSnapshotDate(getDashboardAsOfMs(Date.now()));

    expect(res.ok).toBe(true);
    expect(res.snapshot_date).toBe(expectedDate);
    expect(res.merchantCount).toBe(2);
    expect(mockSet).toHaveBeenCalledTimes(2);

    const firstCall = mockSet.mock.calls[0][0];
    expect(firstCall.data.merchant_id).toBeTruthy();
    expect(firstCall.data.snapshot_date).toBe(expectedDate);
    expect(firstCall.data.payload.ok).toBe(true);
    expect(firstCall.data.payload.tagAnalysis.color).toBeDefined();
  });
});
