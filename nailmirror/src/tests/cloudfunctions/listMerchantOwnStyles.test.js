jest.mock('wx-server-sdk', () => {
  const getTempFileURL = jest.fn();
  return {
    getTempFileURL,
    __mock: { getTempFileURL },
  };
}, { virtual: true });

jest.mock('../../cloudfunctions/ops/utils/db', () => ({
  getAll: jest.fn(),
}));

describe('listMerchantOwnStyles cloud handler', () => {
  let listMerchantOwnStyles;
  let getAll;
  let cloud;

  beforeEach(() => {
    jest.resetModules();
    cloud = require('wx-server-sdk');
    getAll = require('../../cloudfunctions/ops/utils/db').getAll;
    cloud.__mock.getTempFileURL.mockReset();
    getAll.mockReset();
    listMerchantOwnStyles = require('../../cloudfunctions/ops/handlers/listMerchantOwnStyles').listMerchantOwnStyles;
  });

  test('rejects missing openid', async () => {
    const res = await listMerchantOwnStyles({});
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/登录/);
  });

  test('returns all merchant styles including inactive', async () => {
    getAll.mockResolvedValueOnce([
      { _id: 's1', source: 'merchant-upload', merchant_id: 'oid-1', is_active: true, created_at: '2026-06-02' },
      { _id: 's2', source: 'merchant-upload', merchant_id: 'oid-1', is_active: false, created_at: '2026-06-01' },
    ]);

    const res = await listMerchantOwnStyles({ openid: 'oid-1' });
    expect(res.ok).toBe(true);
    expect(res.styles).toHaveLength(2);
    expect(getAll).toHaveBeenCalledWith('styles', {
      source: 'merchant-upload',
      merchant_id: 'oid-1',
    });
    expect(res.styles[0]._id).toBe('s1');
  });

  test('refreshes image urls when file ids exist', async () => {
    getAll.mockResolvedValueOnce([
      { _id: 's1', image_file_id: 'cloud://img/1.jpg', created_at: '2026-06-02' },
    ]);
    cloud.__mock.getTempFileURL.mockResolvedValueOnce({
      fileList: [{ fileID: 'cloud://img/1.jpg', status: 0, tempFileURL: 'https://temp.test/1.jpg' }],
    });

    const res = await listMerchantOwnStyles({ openid: 'oid-1' });
    expect(res.styles[0].image_url).toBe('https://temp.test/1.jpg');
  });
});
