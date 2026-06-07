jest.mock('../../utils/cloud', () => ({
  uploadFile: jest.fn(),
  callFunction: jest.fn()
}));

jest.mock('../../utils/image', () => ({
  compress: jest.fn((p) => Promise.resolve(p + '-compressed'))
}));

jest.mock('../../stores/user.store', () => ({
  userStore: { openid: 'merchant-openid-test' }
}));

describe('MerchantStyleService', () => {
  let merchantStyleService;
  let styleService;
  let cloudUtil;

  beforeEach(() => {
    jest.resetModules();
    cloudUtil = require('../../utils/cloud');
    cloudUtil.uploadFile.mockReset();
    cloudUtil.callFunction.mockReset();
    merchantStyleService = require('../../services/merchant-style.service');
    styleService = require('../../services/style.service');
  });

  test('mergeCachedMerchantStyles dedupes by id and keeps newest item', () => {
    merchantStyleService.mergeCachedMerchantStyles([
      { id: 'merchant-style-1', title: 'Old', heat: 1200 },
      { id: 'merchant-style-2', title: 'Keep', heat: 1300 }
    ]);

    const merged = merchantStyleService.mergeCachedMerchantStyles([
      { id: 'merchant-style-1', title: 'New', heat: 1500 }
    ]);

    expect(merged).toHaveLength(2);
    expect(merged.find((s) => s.id === 'merchant-style-1').title).toBe('New');
    expect(merchantStyleService.getCachedMerchantStyles()).toHaveLength(2);
  });

  test('mapCloudStyleToClientStyle returns existing catalogue fields', () => {
    const mapped = merchantStyleService.mapCloudStyleToClientStyle({
      _id: 'merchant-style-100',
      name: 'Shop Upload',
      color: 'red-family',
      design: 'solid',
      shape: 'almond',
      style: 'daily',
      image_url: 'https://example.test/a.jpg',
      image_file_id: 'cloud://x/a.jpg',
      rank_weight: 1.73,
      merchant_id: 'merchant-1'
    });

    expect(mapped).toMatchObject({
      id: 'merchant-style-100',
      title: 'Shop Upload',
      coverUrl: 'https://example.test/a.jpg',
      sourceUrl: 'https://example.test/a.jpg',
      styleImageFileID: 'cloud://x/a.jpg',
      color: 'red-family',
      design: 'solid',
      shapeLabel: 'almond',
      styleLabel: 'daily',
      heat: 1730,
      merchantId: 'merchant-1',
      styleSource: 'merchant-upload'
    });
    expect(mapped.previewUrls).toEqual(['https://example.test/a.jpg']);
    expect(mapped.displayTags).toEqual(['red-family', 'solid', 'almond', 'daily']);
  });

  test('getCachedMerchantStylesForMerchant only returns styles owned by merchant', () => {
    merchantStyleService.mergeCachedMerchantStyles([
      { id: 'merchant-style-a1', title: 'A1', merchantId: 'merchant-a' },
      { id: 'merchant-style-a2', title: 'A2', merchantId: 'merchant-a' },
      { id: 'merchant-style-b1', title: 'B1', merchantId: 'merchant-b' },
      { id: 'merchant-style-legacy', title: 'Legacy' }
    ]);

    expect(merchantStyleService.getCachedMerchantStyles()).toHaveLength(4);
    expect(merchantStyleService.getCachedMerchantStylesForMerchant('merchant-a')).toHaveLength(2);
    expect(merchantStyleService.getCachedMerchantStylesForMerchant('merchant-b')).toHaveLength(1);
    expect(merchantStyleService.getCachedMerchantStylesForMerchant('merchant-c')).toHaveLength(0);
    expect(merchantStyleService.getCachedMerchantStylesForMerchant('')).toHaveLength(0);
  });

  test('getCachedMerchantStyles backfills previewUrls for old cached uploads', () => {
    wx.setStorageSync('np_merchant_styles', [{
      id: 'merchant-style-old',
      title: 'Old Cached',
      coverUrl: 'https://example.test/old.jpg',
      sourceUrl: 'https://example.test/old-detail.jpg'
    }]);

    const cached = merchantStyleService.getCachedMerchantStyles();

    expect(cached[0].previewUrls).toEqual([
      'https://example.test/old.jpg',
      'https://example.test/old-detail.jpg'
    ]);
  });

  test('uploadMerchantStyles uploads each file and caches successful styles', async () => {
    cloudUtil.uploadFile
      .mockResolvedValueOnce({ fileID: 'cloud://style/1.jpg' })
      .mockResolvedValueOnce({ fileID: 'cloud://style/2.jpg' });
    cloudUtil.callFunction.mockResolvedValueOnce({
      ok: true,
      styles: [
        {
          _id: 'merchant-style-1',
          name: 'Uploaded One',
          color: 'pink',
          design: 'solid',
          shape: 'round',
          style: 'daily',
          image_url: 'https://example.test/1.jpg',
          image_file_id: 'cloud://style/1.jpg',
          rank_weight: 1.55,
          merchant_id: 'merchant-1'
        }
      ],
      failed: [{ fileID: 'cloud://style/2.jpg', error: 'VLM failed' }]
    });

    const result = await merchantStyleService.uploadMerchantStyles(['/tmp/a.jpg', '/tmp/b.png']);

    expect(cloudUtil.uploadFile).toHaveBeenCalledTimes(2);
    expect(cloudUtil.callFunction).toHaveBeenCalledWith('ops', expect.objectContaining({
      action: 'uploadMerchantStyles',
      role: 'b',
      merchantId: 'merchant-openid-test',
      items: [
        { fileID: 'cloud://style/1.jpg', originalName: 'a.jpg' },
        { fileID: 'cloud://style/2.jpg', originalName: 'b.png' }
      ]
    }));
    expect(result.styles).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
    expect(merchantStyleService.getCachedMerchantStyles()).toHaveLength(1);
  });

  test('styleService list/search/categories include cached merchant styles', async () => {
    merchantStyleService.mergeCachedMerchantStyles([
      {
        id: 'merchant-style-hot',
        title: 'Merchant Hot',
        brief: 'merchant upload',
        coverUrl: 'https://example.test/hot.jpg',
        color: 'merchant-color',
        design: 'merchant-design',
        shapeLabel: 'merchant-shape',
        styleLabel: 'merchant-style',
        displayTags: ['merchant-color', 'merchant-design', 'merchant-shape', 'merchant-style'],
        heat: 999999,
        isActive: true
      }
    ]);

    const listed = await styleService.list({ page: 1, pageSize: 1 });
    expect(listed.items[0].id).toBe('merchant-style-hot');

    const searched = await styleService.search({ keyword: 'Merchant Hot' });
    expect(searched.items.map((s) => s.id)).toContain('merchant-style-hot');

    const categories = styleService.getCategories();
    expect(categories.colors).toContain('merchant-color');
    expect(categories.designs).toContain('merchant-design');
  });
});
