jest.mock('wx-server-sdk', () => {
  const get = jest.fn();
  const where = jest.fn();
  const limit = jest.fn();
  const collection = jest.fn(() => ({
    where: where.mockReturnValue({ limit: limit.mockReturnValue({ get }) }),
  }));
  const createCollection = jest.fn().mockResolvedValue({});
  return {
    database: jest.fn(() => ({ collection, createCollection })),
    __mock: { get, where, limit, collection, createCollection },
  };
}, { virtual: true });

describe('getMerchantPhoneGate cloud handler', () => {
  let getMerchantPhoneGate;
  let isPhoneRecentlyVerified;
  let cloud;

  beforeEach(() => {
    jest.resetModules();
    cloud = require('wx-server-sdk');
    cloud.__mock.get.mockReset();
    const mod = require('../../cloudfunctions/ops/handlers/getMerchantPhoneGate');
    getMerchantPhoneGate = mod.getMerchantPhoneGate;
    isPhoneRecentlyVerified = mod.isPhoneRecentlyVerified;
  });

  test('returns merchantVerified false when no openid', async () => {
    const res = await getMerchantPhoneGate({});
    expect(res).toEqual({
      ok: true,
      merchantVerified: false,
      phoneVerified: false,
      phoneMasked: '',
    });
  });

  test('returns phoneVerified when last_phone_verified_at within 24h', async () => {
    cloud.__mock.get.mockResolvedValueOnce({
      data: [{
        _id: 'm1',
        openid: 'oid-1',
        phone: '13812345678',
        status: 'approved',
        last_phone_verified_at: new Date().toISOString(),
      }],
    });
    const res = await getMerchantPhoneGate({ openid: 'oid-1' });
    expect(res.merchantVerified).toBe(true);
    expect(res.phoneVerified).toBe(true);
    expect(res.phoneMasked).toBe('138****5678');
  });

  test('isPhoneRecentlyVerified false when expired', () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    expect(isPhoneRecentlyVerified({ last_phone_verified_at: old })).toBe(false);
  });
});
