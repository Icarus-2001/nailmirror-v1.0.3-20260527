jest.mock('wx-server-sdk', () => {
  const get = jest.fn();
  const whereUpdate = jest.fn().mockResolvedValue({});
  const docUpdate = jest.fn().mockResolvedValue({});
  const doc = jest.fn(() => ({ get, update: docUpdate }));
  const where = jest.fn();
  const limit = jest.fn();
  const collection = jest.fn(() => ({
    where: where.mockReturnValue({
      limit: limit.mockReturnValue({ get }),
      update: whereUpdate,
    }),
    doc,
  }));
  const createCollection = jest.fn().mockResolvedValue({});
  return {
    database: jest.fn(() => ({ collection, createCollection })),
    __mock: { get, whereUpdate, docUpdate, doc, collection, createCollection, where },
  };
}, { virtual: true });

jest.mock('../../cloudfunctions/ops/utils/db', () => ({
  getAll: jest.fn(),
}));

describe('revokeMerchantQualification cloud handler', () => {
  let revokeMerchantQualification;
  let cloud;
  let getAll;

  beforeEach(() => {
    jest.resetModules();
    cloud = require('wx-server-sdk');
    getAll = require('../../cloudfunctions/ops/utils/db').getAll;
    cloud.__mock.get.mockReset();
    cloud.__mock.whereUpdate.mockReset().mockResolvedValue({});
    cloud.__mock.docUpdate.mockReset().mockResolvedValue({});
    cloud.__mock.doc.mockReset().mockImplementation(() => ({ update: cloud.__mock.docUpdate }));
    getAll.mockReset();
    revokeMerchantQualification = require('../../cloudfunctions/ops/handlers/revokeMerchantQualification').revokeMerchantQualification;
  });

  test('rejects phone mismatch', async () => {
    cloud.__mock.get.mockResolvedValueOnce({
      data: [{ _id: 'm1', openid: 'oid-1', phone: '13812345678', status: 'approved' }],
    });

    const res = await revokeMerchantQualification({ openid: 'oid-1', phone: '13900001111' });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/不一致/);
  });

  test('revokes merchant and deactivates styles', async () => {
    cloud.__mock.get
      .mockResolvedValueOnce({
        data: [{ _id: 'm1', openid: 'oid-1', phone: '13812345678', status: 'approved' }],
      })
      .mockRejectedValueOnce({ message: 'does not exist' });
    getAll.mockResolvedValueOnce([{ _id: 's1' }, { _id: 's2' }]);

    const res = await revokeMerchantQualification({ openid: 'oid-1', phone: '13812345678' });
    expect(res.ok).toBe(true);
    expect(res.revoked).toBe(true);
    expect(res.stylesDeactivated).toBe(2);
    expect(cloud.__mock.doc).toHaveBeenCalledWith('m1');
    expect(cloud.__mock.where).toHaveBeenCalled();
  });
});
