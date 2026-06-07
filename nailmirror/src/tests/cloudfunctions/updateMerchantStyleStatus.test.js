jest.mock('wx-server-sdk', () => {
  const get = jest.fn();
  const docUpdate = jest.fn().mockResolvedValue({});
  const doc = jest.fn(() => ({ get, update: docUpdate }));
  const collection = jest.fn(() => ({ doc }));
  return {
    database: jest.fn(() => ({ collection })),
    __mock: { get, docUpdate, doc },
  };
}, { virtual: true });

describe('updateMerchantStyleStatus cloud handler', () => {
  let updateMerchantStyleStatus;
  let cloud;

  beforeEach(() => {
    jest.resetModules();
    cloud = require('wx-server-sdk');
    cloud.__mock.get.mockReset();
    cloud.__mock.docUpdate.mockReset().mockResolvedValue({});
    updateMerchantStyleStatus = require('../../cloudfunctions/ops/handlers/updateMerchantStyleStatus').updateMerchantStyleStatus;
  });

  test('rejects non-owned style', async () => {
    cloud.__mock.get.mockResolvedValueOnce({
      data: { source: 'merchant-upload', merchant_id: 'other-oid' },
    });

    const res = await updateMerchantStyleStatus({
      openid: 'oid-1',
      styleId: 's1',
      is_active: false,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/无权/);
  });

  test('deactivates owned style with deactivated_at', async () => {
    cloud.__mock.get.mockResolvedValueOnce({
      data: { source: 'merchant-upload', merchant_id: 'oid-1', is_active: true },
    });

    const res = await updateMerchantStyleStatus({
      openid: 'oid-1',
      styleId: 's1',
      is_active: false,
    });
    expect(res.ok).toBe(true);
    expect(res.is_active).toBe(false);
    expect(cloud.__mock.docUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        is_active: false,
        deactivated_at: expect.any(String),
      }),
    });
  });

  test('reactivates owned style and clears deactivated_at', async () => {
    cloud.__mock.get.mockResolvedValueOnce({
      data: { source: 'merchant-upload', merchant_id: 'oid-1', is_active: false },
    });

    const res = await updateMerchantStyleStatus({
      openid: 'oid-1',
      styleId: 's1',
      is_active: true,
    });
    expect(res.ok).toBe(true);
    expect(cloud.__mock.docUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        is_active: true,
        deactivated_at: null,
      }),
    });
  });
});
