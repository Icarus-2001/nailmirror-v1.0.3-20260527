jest.mock('wx-server-sdk', () => {
  const add = jest.fn();
  const getTempFileURL = jest.fn();
  return {
    init: jest.fn(),
    DYNAMIC_CURRENT_ENV: 'test-env',
    database: jest.fn(() => ({
      collection: jest.fn(() => ({ add }))
    })),
    getTempFileURL,
    __mock: { add, getTempFileURL }
  };
}, { virtual: true });

jest.mock('../../cloudfunctions/ops/utils/llm', () => ({
  tagNailImage: jest.fn()
}));

describe('uploadMerchantStyles cloud handler', () => {
  let uploadMerchantStyles;
  let cloud;
  let tagNailImage;

  beforeEach(() => {
    jest.resetModules();
    cloud = require('wx-server-sdk');
    tagNailImage = require('../../cloudfunctions/ops/utils/llm').tagNailImage;
    cloud.__mock.add.mockReset();
    cloud.__mock.getTempFileURL.mockReset();
    tagNailImage.mockReset();
    uploadMerchantStyles = require('../../cloudfunctions/ops/handlers/uploadMerchantStyles').uploadMerchantStyles;
  });

  test('rejects non merchant role in debug auth mode', async () => {
    await expect(uploadMerchantStyles({ role: 'c', items: [] })).rejects.toThrow('merchant role');
  });

  test('tags and stores every valid item', async () => {
    cloud.__mock.getTempFileURL.mockResolvedValueOnce({
      fileList: [{ fileID: 'cloud://style/1.jpg', status: 0, tempFileURL: 'https://temp.test/1.jpg' }]
    });
    tagNailImage.mockResolvedValueOnce({
      name: 'Shop Style',
      color: 'pink',
      design: 'solid',
      shape: 'round',
      style: 'daily'
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
      color: 'pink',
      design: 'solid',
      shape: 'round',
      style: 'daily',
      image_url: 'https://temp.test/1.jpg',
      image_file_id: 'cloud://style/1.jpg',
      merchant_id: 'merchant-1',
      source: 'merchant-upload',
      is_active: true
    });
    expect(typeof result.styles[0].rank_weight).toBe('number');
  });

  test('single item failure does not block other uploads', async () => {
    cloud.__mock.getTempFileURL
      .mockRejectedValueOnce(new Error('temp url failed'))
      .mockResolvedValueOnce({
        fileList: [{ fileID: 'cloud://style/2.jpg', status: 0, tempFileURL: 'https://temp.test/2.jpg' }]
      });
    tagNailImage.mockResolvedValueOnce({
      name: '',
      color: 'blue',
      design: 'cat-eye',
      shape: 'almond',
      style: 'cool'
    });
    cloud.__mock.add.mockResolvedValueOnce({ _id: 'merchant-style-2' });

    const result = await uploadMerchantStyles({
      role: 'b',
      items: [
        { fileID: 'cloud://style/1.jpg' },
        { fileID: 'cloud://style/2.jpg', originalName: 'two.jpg' }
      ]
    });

    expect(result.styles).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].fileID).toBe('cloud://style/1.jpg');
  });
});
