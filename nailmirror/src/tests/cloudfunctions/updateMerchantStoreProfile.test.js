const mockUpdate = jest.fn().mockResolvedValue({});

jest.mock('wx-server-sdk', () => ({
  database: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        update: mockUpdate,
      })),
    })),
  })),
}), { virtual: true });

jest.mock('../../cloudfunctions/ops/utils/collections', () => ({
  ensureCollection: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../cloudfunctions/ops/utils/merchant', () => ({
  findMerchantByOpenid: jest.fn(),
}));

const { updateMerchantStoreProfile } = require('../../cloudfunctions/ops/handlers/updateMerchantStoreProfile');
const { findMerchantByOpenid } = require('../../cloudfunctions/ops/utils/merchant');

describe('updateMerchantStoreProfile', () => {
  beforeEach(() => {
    mockUpdate.mockClear();
    findMerchantByOpenid.mockReset();
  });

  test('rejects invalid phone', async () => {
    findMerchantByOpenid.mockResolvedValueOnce({ _id: 'm1', status: 'approved' });
    const res = await updateMerchantStoreProfile({
      openid: 'oid-1',
      storeName: '店',
      phone: '123',
    });
    expect(res.ok).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('rejects when within cooldown', async () => {
    findMerchantByOpenid.mockResolvedValueOnce({
      _id: 'm1',
      status: 'approved',
      store_profile_updated_at: new Date().toISOString(),
    });
    const res = await updateMerchantStoreProfile({
      openid: 'oid-1',
      storeName: '新店名',
      phone: '13800138001',
      businessHours: '09:00-21:00',
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/每月仅可修改一次/);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('updates merchant fields on success', async () => {
    findMerchantByOpenid.mockResolvedValueOnce({
      _id: 'm1',
      status: 'approved',
      province: '江苏省',
      city: '南京市',
    });
    const res = await updateMerchantStoreProfile({
      openid: 'oid-1',
      storeName: '星辰美甲·国贸店',
      phone: '13800138001',
      businessHours: '10:00-22:00',
    });
    expect(res.ok).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
    const patch = mockUpdate.mock.calls[0][0].data;
    expect(patch.store_name).toBe('星辰美甲·国贸店');
    expect(patch.phone).toBe('13800138001');
    expect(patch.business_hours).toBe('10:00-22:00');
    expect(patch.store_profile_updated_at).toBeTruthy();
    expect(res.profile.storeName).toBe('星辰美甲·国贸店');
    expect(res.editPolicy.canEdit).toBe(false);
  });
});
