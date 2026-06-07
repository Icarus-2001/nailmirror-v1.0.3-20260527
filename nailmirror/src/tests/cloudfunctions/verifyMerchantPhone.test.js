jest.mock('wx-server-sdk', () => {
  const get = jest.fn();
  const update = jest.fn();
  const doc = jest.fn(() => ({ update }));
  const where = jest.fn();
  const limit = jest.fn();
  const collection = jest.fn(() => ({
    where: where.mockReturnValue({ limit: limit.mockReturnValue({ get }) }),
    doc,
  }));
  const createCollection = jest.fn().mockResolvedValue({});
  return {
    database: jest.fn(() => ({ collection, createCollection })),
    openapi: {
      phonenumber: {
        getPhoneNumber: jest.fn(),
      },
    },
    __mock: { get, update, doc, collection, createCollection },
  };
}, { virtual: true });

describe('verifyMerchantPhone cloud handler', () => {
  let verifyMerchantPhone;
  let cloud;

  beforeEach(() => {
    jest.resetModules();
    cloud = require('wx-server-sdk');
    cloud.__mock.get.mockReset();
    cloud.__mock.update.mockReset();
    cloud.openapi.phonenumber.getPhoneNumber.mockReset();
    verifyMerchantPhone = require('../../cloudfunctions/ops/handlers/verifyMerchantPhone').verifyMerchantPhone;
  });

  test('rejects when phone mismatch', async () => {
    cloud.__mock.get.mockResolvedValueOnce({
      data: [{ _id: 'm1', phone: '13812345678', status: 'approved' }],
    });
    cloud.openapi.phonenumber.getPhoneNumber.mockResolvedValueOnce({
      phoneInfo: { purePhoneNumber: '13900001111' },
    });

    const res = await verifyMerchantPhone({ openid: 'oid-1', code: 'test-code' });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/不一致/);
  });

  test('succeeds when phone matches', async () => {
    cloud.__mock.get.mockResolvedValueOnce({
      data: [{ _id: 'm1', phone: '13812345678', status: 'approved' }],
    });
    cloud.openapi.phonenumber.getPhoneNumber.mockResolvedValueOnce({
      phoneInfo: { purePhoneNumber: '13812345678' },
    });
    cloud.__mock.update.mockResolvedValueOnce({});

    const res = await verifyMerchantPhone({ openid: 'oid-1', code: 'test-code' });
    expect(res.ok).toBe(true);
    expect(res.phoneVerified).toBe(true);
    expect(cloud.__mock.doc).toHaveBeenCalledWith('m1');
  });
});
