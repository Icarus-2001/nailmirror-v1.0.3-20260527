jest.mock('wx-server-sdk', () => {
  const get = jest.fn();
  const docRemove = jest.fn().mockResolvedValue({});
  const doc = jest.fn(() => ({ get, remove: docRemove }));
  const collection = jest.fn(() => ({ doc }));
  const deleteFile = jest.fn().mockResolvedValue({});
  return {
    database: jest.fn(() => ({ collection })),
    deleteFile,
    __mock: { get, docRemove, deleteFile, doc },
  };
}, { virtual: true });

jest.mock('../../cloudfunctions/ops/utils/db', () => ({
  getAll: jest.fn(),
}));

describe('deleteMerchantStyle cloud handler', () => {
  let deleteMerchantStyle;
  let cloud;
  let getAll;

  beforeEach(() => {
    jest.resetModules();
    cloud = require('wx-server-sdk');
    getAll = require('../../cloudfunctions/ops/utils/db').getAll;
    cloud.__mock.get.mockReset();
    cloud.__mock.docRemove.mockReset().mockResolvedValue({});
    cloud.__mock.deleteFile.mockReset().mockResolvedValue({});
    getAll.mockReset().mockResolvedValue([]);
    deleteMerchantStyle = require('../../cloudfunctions/ops/handlers/deleteMerchantStyle').deleteMerchantStyle;
  });

  test('rejects non-owned style', async () => {
    cloud.__mock.get.mockResolvedValueOnce({
      data: { source: 'merchant-upload', merchant_id: 'other-oid' },
    });

    const res = await deleteMerchantStyle({ openid: 'oid-1', styleId: 's1' });
    expect(res.ok).toBe(false);
  });

  test('cascades delete related records and style doc', async () => {
    cloud.__mock.get.mockResolvedValueOnce({
      data: {
        source: 'merchant-upload',
        merchant_id: 'oid-1',
        image_file_id: 'cloud://img/1.jpg',
      },
    });
    getAll
      .mockResolvedValueOnce([{ _id: 'r1' }])
      .mockResolvedValueOnce([{ _id: 't1' }, { _id: 't2' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ _id: 'e1' }]);

    const res = await deleteMerchantStyle({ openid: 'oid-1', styleId: 's1' });
    expect(res.ok).toBe(true);
    expect(res.removed.ratings).toBe(1);
    expect(res.removed.tryonLogs).toBe(2);
    expect(res.removed.events).toBe(1);
    expect(cloud.__mock.deleteFile).toHaveBeenCalledWith({ fileList: ['cloud://img/1.jpg'] });
    expect(cloud.__mock.docRemove).toHaveBeenCalled();
  });
});
