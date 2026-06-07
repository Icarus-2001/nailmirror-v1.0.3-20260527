jest.mock('wx-server-sdk', () => {
  const get = jest.fn();
  const where = jest.fn();
  const limit = jest.fn();
  const collection = jest.fn(() => ({
    doc: jest.fn(() => ({ get })),
    where: where.mockReturnValue({ limit: limit.mockReturnValue({ get }) }),
  }));
  const createCollection = jest.fn().mockResolvedValue({});
  return {
    init: jest.fn(),
    database: jest.fn(() => ({ collection, createCollection })),
    __mock: { get, where, limit, collection, createCollection },
  };
}, { virtual: true });

describe('getMerchantContact cloud handler', () => {
  let getMerchantContact;
  let cloud;

  beforeEach(() => {
    jest.resetModules();
    cloud = require('wx-server-sdk');
    cloud.__mock.get.mockReset();
    cloud.__mock.where.mockReset();
    cloud.__mock.limit.mockReset();
    cloud.__mock.collection.mockClear();
    getMerchantContact = require('../../cloudfunctions/ops/handlers/getMerchantContact').getMerchantContact;
  });

  test('rejects platform style', async () => {
    cloud.__mock.get.mockResolvedValueOnce({
      data: { _id: 'style-1', source: 'platform', is_active: true },
    });

    const result = await getMerchantContact({ styleId: 'style-1' });
    expect(result).toEqual({
      ok: false,
      reason: 'not_merchant_style',
      message: '该款式不来源于任何入驻商家',
    });
  });

  test('returns merchant contact for merchant-upload style', async () => {
    cloud.__mock.get
      .mockResolvedValueOnce({
        data: {
          _id: 'merchant-style-1',
          source: 'merchant-upload',
          merchant_id: '0f8f1fb66a2408810038a63b137a2ed3',
          is_active: true,
        },
      })
      .mockResolvedValueOnce({
        data: [{
          openid: '0f8f1fb66a2408810038a63b137a2ed3',
          store_name: '测试门店',
          phone: '17312270775',
          province: '江苏省',
          city: '南京市',
          business_hours: '10:00-22:00',
        }],
      });

    const result = await getMerchantContact({ styleId: 'merchant-style-1' });
    expect(result.ok).toBe(true);
    expect(result.contact).toMatchObject({
      storeName: '测试门店',
      phone: '17312270775',
      province: '江苏省',
      city: '南京市',
      businessHours: '10:00-22:00',
    });
  });
});
