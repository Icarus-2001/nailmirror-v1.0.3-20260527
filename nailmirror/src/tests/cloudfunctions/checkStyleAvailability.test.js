jest.mock('wx-server-sdk', () => {
  const get = jest.fn();
  const doc = jest.fn(() => ({ get }));
  const where = jest.fn();
  const limit = jest.fn();
  const collection = jest.fn(() => ({
    doc,
    where: where.mockReturnValue({ limit: limit.mockReturnValue({ get }) }),
  }));
  return {
    database: jest.fn(() => ({ collection })),
    __mock: { get, doc },
  };
}, { virtual: true });

describe('checkStyleAvailability cloud handler', () => {
  let checkStyleAvailability;
  let cloud;

  beforeEach(() => {
    jest.resetModules();
    cloud = require('wx-server-sdk');
    cloud.__mock.get.mockReset();
    checkStyleAvailability = require('../../cloudfunctions/ops/handlers/checkStyleAvailability').checkStyleAvailability;
  });

  test('returns merchant_revoked for inactive merchant style', async () => {
    cloud.__mock.get
      .mockResolvedValueOnce({
        data: {
          source: 'merchant-upload',
          merchant_id: 'oid-1',
          is_active: false,
        },
      })
      .mockResolvedValueOnce({
        data: [{ openid: 'oid-1', status: 'revoked' }],
      });

    const res = await checkStyleAvailability({ styleId: 'merchant-style-1' });
    expect(res.ok).toBe(true);
    expect(res.available).toBe(false);
    expect(res.reason).toBe('merchant_revoked');
  });

  test('returns available for active style', async () => {
    cloud.__mock.get.mockResolvedValueOnce({
      data: { source: 'merchant-upload', is_active: true },
    });

    const res = await checkStyleAvailability({ styleId: 'merchant-style-2' });
    expect(res.available).toBe(true);
  });
});
