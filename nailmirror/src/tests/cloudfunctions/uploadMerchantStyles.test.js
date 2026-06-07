jest.mock('wx-server-sdk', () => {
  const add = jest.fn();
  const getTempFileURL = jest.fn();
  const downloadFile = jest.fn();
  return {
    init: jest.fn(),
    DYNAMIC_CURRENT_ENV: 'test-env',
    database: jest.fn(() => ({
      collection: jest.fn(() => ({ add }))
    })),
    getTempFileURL,
    downloadFile,
    __mock: { add, getTempFileURL, downloadFile }
  };
}, { virtual: true });

jest.mock('../../cloudfunctions/ops/utils/llm', () => ({
  analyzeNailStyleImage: jest.fn(),
  tagNailImage: jest.fn()
}));

jest.mock('../../cloudfunctions/ops/utils/merchant', () => ({
  findMerchantByOpenid: jest.fn()
}));

jest.mock('../../cloudfunctions/ops/utils/merchantDuplicate', () => ({
  assertNotDuplicate: jest.fn()
}));

jest.mock('../../cloudfunctions/ops/utils/imageFingerprint', () => ({
  computeFingerprint: jest.fn()
}));

describe('uploadMerchantStyles cloud handler', () => {
  let uploadMerchantStyles;
  let cloud;
  let analyzeNailStyleImage;
  let findMerchantByOpenid;
  let assertNotDuplicate;
  let computeFingerprint;

  beforeEach(() => {
    jest.resetModules();
    cloud = require('wx-server-sdk');
    analyzeNailStyleImage = require('../../cloudfunctions/ops/utils/llm').analyzeNailStyleImage;
    findMerchantByOpenid = require('../../cloudfunctions/ops/utils/merchant').findMerchantByOpenid;
    assertNotDuplicate = require('../../cloudfunctions/ops/utils/merchantDuplicate').assertNotDuplicate;
    computeFingerprint = require('../../cloudfunctions/ops/utils/imageFingerprint').computeFingerprint;
    cloud.__mock.add.mockReset();
    cloud.__mock.getTempFileURL.mockReset();
    cloud.__mock.downloadFile.mockReset();
    analyzeNailStyleImage.mockReset();
    findMerchantByOpenid.mockReset();
    assertNotDuplicate.mockReset();
    computeFingerprint.mockReset();
    findMerchantByOpenid.mockResolvedValue({ openid: 'merchant-1', store_name: 'Test Shop' });
    cloud.__mock.downloadFile.mockResolvedValue({ fileContent: Buffer.from('fake-image') });
    computeFingerprint.mockResolvedValue({ md5: 'md5-1', phash: 'abcd1234abcd1234' });
    assertNotDuplicate.mockResolvedValue(undefined);
    uploadMerchantStyles = require('../../cloudfunctions/ops/handlers/uploadMerchantStyles').uploadMerchantStyles;
  });

  test('rejects non merchant role in debug auth mode', async () => {
    await expect(uploadMerchantStyles({ role: 'c', items: [] })).rejects.toThrow('merchant role');
  });

  test('tags and stores every valid item with fingerprint fields', async () => {
    cloud.__mock.getTempFileURL.mockResolvedValueOnce({
      fileList: [{ fileID: 'cloud://style/1.jpg', status: 0, tempFileURL: 'https://temp.test/1.jpg' }]
    });
    analyzeNailStyleImage.mockResolvedValueOnce({
      isNailArt: true,
      confidence: 0.95,
      name: 'Shop Style',
      color: '红粉色系',
      design: '纯色',
      shape: '中长圆',
      style: '日常百搭'
    });
    cloud.__mock.add.mockResolvedValueOnce({ _id: 'merchant-style-generated' });

    const result = await uploadMerchantStyles({
      role: 'b',
      merchantId: 'merchant-1',
      items: [{ fileID: 'cloud://style/1.jpg', originalName: 'one.jpg' }]
    });

    expect(result.ok).toBe(true);
    expect(result.styles).toHaveLength(1);
    expect(result.failed).toHaveLength(0);
    expect(result.styles[0]).toMatchObject({
      name: 'Shop Style',
      color: '红粉色系',
      image_url: 'https://temp.test/1.jpg',
      image_file_id: 'cloud://style/1.jpg',
      image_md5: 'md5-1',
      image_phash: 'abcd1234abcd1234',
      merchant_id: 'merchant-1',
      source: 'merchant-upload',
      is_active: true
    });
    expect(assertNotDuplicate).toHaveBeenCalled();
  });

  test('rejects upload when merchant is not verified', async () => {
    findMerchantByOpenid.mockResolvedValueOnce(null);
    await expect(uploadMerchantStyles({
      role: 'b',
      callerOpenid: 'unknown-openid',
      items: [{ fileID: 'cloud://style/1.jpg' }],
    })).rejects.toThrow('商家身份认证');
  });

  test('returns NOT_NAIL_ART code when VLM rejects image', async () => {
    cloud.__mock.getTempFileURL.mockResolvedValueOnce({
      fileList: [{ fileID: 'cloud://style/1.jpg', status: 0, tempFileURL: 'https://temp.test/1.jpg' }]
    });
    const err = new Error('风景照片');
    err.code = 'NOT_NAIL_ART';
    analyzeNailStyleImage.mockRejectedValueOnce(err);

    const result = await uploadMerchantStyles({
      role: 'b',
      callerOpenid: 'merchant-1',
      items: [{ fileID: 'cloud://style/1.jpg', originalName: 'bad.jpg' }]
    });

    expect(result.styles).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].code).toBe('NOT_NAIL_ART');
  });

  test('single item failure does not block other uploads', async () => {
    const dupErr = new Error('duplicate');
    dupErr.code = 'DUPLICATE_EXACT';
    assertNotDuplicate
      .mockRejectedValueOnce(dupErr)
      .mockResolvedValueOnce(undefined);
    cloud.__mock.getTempFileURL.mockResolvedValueOnce({
      fileList: [{ fileID: 'cloud://style/2.jpg', status: 0, tempFileURL: 'https://temp.test/2.jpg' }]
    });
    analyzeNailStyleImage.mockResolvedValueOnce({
      isNailArt: true,
      confidence: 0.9,
      name: '',
      color: '蓝紫色系',
      design: '猫眼',
      shape: '中长杏仁',
      style: '酷飒个性'
    });
    cloud.__mock.add.mockResolvedValueOnce({ _id: 'merchant-style-2' });

    const result = await uploadMerchantStyles({
      role: 'b',
      callerOpenid: 'merchant-1',
      items: [
        { fileID: 'cloud://style/1.jpg' },
        { fileID: 'cloud://style/2.jpg', originalName: 'two.jpg' }
      ]
    });

    expect(result.styles).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].code).toBe('DUPLICATE_EXACT');
    expect(result.failed[0].fileID).toBe('cloud://style/1.jpg');
  });
});
