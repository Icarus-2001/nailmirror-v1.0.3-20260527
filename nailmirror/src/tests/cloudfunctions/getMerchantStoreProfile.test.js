jest.mock('wx-server-sdk', () => ({
  database: jest.fn(),
}), { virtual: true });

jest.mock('../../cloudfunctions/ops/utils/collections', () => ({
  ensureCollection: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../cloudfunctions/ops/utils/merchant', () => ({
  findMerchantByOpenid: jest.fn(),
}));

const { getMerchantStoreProfile } = require('../../cloudfunctions/ops/handlers/getMerchantStoreProfile');
const { findMerchantByOpenid } = require('../../cloudfunctions/ops/utils/merchant');

describe('getMerchantStoreProfile', () => {
  beforeEach(() => {
    findMerchantByOpenid.mockReset();
  });

  test('rejects missing openid', async () => {
    const res = await getMerchantStoreProfile({});
    expect(res.ok).toBe(false);
  });

  test('rejects unverified merchant', async () => {
    findMerchantByOpenid.mockResolvedValueOnce({ status: 'revoked' });
    const res = await getMerchantStoreProfile({ openid: 'oid-1' });
    expect(res.ok).toBe(false);
  });

  test('returns profile and canEdit when never updated', async () => {
    findMerchantByOpenid.mockResolvedValueOnce({
      store_name: '测试店',
      phone: '13800138001',
      business_hours: '10:00-22:00',
      province: '江苏省',
      city: '南京市',
      status: 'approved',
    });
    const res = await getMerchantStoreProfile({ openid: 'oid-1' });
    expect(res.ok).toBe(true);
    expect(res.profile).toMatchObject({
      storeName: '测试店',
      phone: '13800138001',
      businessHours: '10:00-22:00',
    });
    expect(res.editPolicy.canEdit).toBe(true);
  });

  test('returns canEdit false within 30 days', async () => {
    const recent = new Date().toISOString();
    findMerchantByOpenid.mockResolvedValueOnce({
      store_name: '测试店',
      phone: '13800138001',
      status: 'approved',
      store_profile_updated_at: recent,
    });
    const res = await getMerchantStoreProfile({ openid: 'oid-2' });
    expect(res.ok).toBe(true);
    expect(res.editPolicy.canEdit).toBe(false);
    expect(res.editPolicy.nextEditableAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
