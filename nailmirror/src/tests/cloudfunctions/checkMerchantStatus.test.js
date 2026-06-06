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

describe('checkMerchantStatus cloud handler', () => {
  let checkMerchantStatus;
  let cloud;

  beforeEach(() => {
    jest.resetModules();
    cloud = require('wx-server-sdk');
    cloud.__mock.get.mockReset();
    checkMerchantStatus = require('../../cloudfunctions/ops/handlers/checkMerchantStatus').checkMerchantStatus;
  });

  test('returns verified false when openid missing', async () => {
    const result = await checkMerchantStatus({});
    expect(result).toEqual({ ok: true, verified: false });
  });

  test('returns verified true when merchants record exists', async () => {
    cloud.__mock.get.mockResolvedValueOnce({
      data: [{ openid: 'user-1', status: 'approved', store_name: 'Test' }],
    });
    const result = await checkMerchantStatus({ openid: 'user-1' });
    expect(result).toEqual({ ok: true, verified: true });
  });

  test('returns verified false when no merchants record', async () => {
    cloud.__mock.get.mockResolvedValueOnce({ data: [] });
    const result = await checkMerchantStatus({ openid: 'user-2' });
    expect(result).toEqual({ ok: true, verified: false });
  });
});
