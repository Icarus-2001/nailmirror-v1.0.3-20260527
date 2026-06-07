jest.mock('wx-server-sdk', () => {
  const add = jest.fn();
  const update = jest.fn();
  const get = jest.fn();
  const doc = jest.fn(() => ({ get, update }));
  const collection = jest.fn(() => ({ add, doc }));
  const uploadFile = jest.fn();
  const getTempFileURL = jest.fn();
  return {
    init: jest.fn(),
    DYNAMIC_CURRENT_ENV: 'test-env',
    database: jest.fn(() => ({ collection })),
    uploadFile,
    getTempFileURL,
    __mock: { add, update, get, doc, collection, uploadFile, getTempFileURL }
  };
}, { virtual: true });

jest.mock('../../cloudfunctions/ops/utils/db', () => ({
  getAll: jest.fn()
}));

jest.mock('../../cloudfunctions/ops/utils/llm', () => ({
  tagNailImage: jest.fn()
}));

jest.mock('https', () => ({
  get: jest.fn()
}));

describe('importXhsHotTop10 cloud handler', () => {
  let importXhsHotTop10;
  let cloud;
  let tagNailImage;
  let getAll;
  let https;

  beforeEach(() => {
    jest.resetModules();
    delete process.env.ADMIN_OPENIDS;
    cloud = require('wx-server-sdk');
    tagNailImage = require('../../cloudfunctions/ops/utils/llm').tagNailImage;
    getAll = require('../../cloudfunctions/ops/utils/db').getAll;
    https = require('https');
    cloud.__mock.add.mockReset();
    cloud.__mock.update.mockReset();
    cloud.__mock.get.mockReset();
    cloud.__mock.uploadFile.mockReset();
    cloud.__mock.getTempFileURL.mockReset();
    tagNailImage.mockReset();
    getAll.mockReset();
    https.get.mockReset();
    importXhsHotTop10 = require('../../cloudfunctions/ops/handlers/importXhsHotTop10').importXhsHotTop10;
  });

  function mockDownload(buf) {
    https.get.mockImplementation((_url, cb) => {
      const res = {
        statusCode: 200,
        headers: {},
        on: (ev, fn) => {
          if (ev === 'data') fn(buf || Buffer.from('img'));
          if (ev === 'end') fn();
        },
        resume: jest.fn()
      };
      cb(res);
      return { on: jest.fn() };
    });
  }

  test('rejects non-admin when ADMIN_OPENIDS configured', async () => {
    const prev = process.env.ADMIN_OPENIDS;
    process.env.ADMIN_OPENIDS = 'admin-openid';
    await expect(importXhsHotTop10({
      callerOpenid: 'other',
      items: [{ cover_url: 'https://x.test/a.jpg', rank: 1 }]
    })).rejects.toThrow('无权限');
    process.env.ADMIN_OPENIDS = prev;
  });

  test('imports one item with VLM tags and cloud upload', async () => {
    mockDownload(Buffer.from('webp-image'));
    cloud.__mock.uploadFile.mockResolvedValueOnce({ fileID: 'cloud://xhs-hot/1.webp' });
    cloud.__mock.getTempFileURL.mockResolvedValueOnce({
      fileList: [{ fileID: 'cloud://xhs-hot/1.webp', status: 0, tempFileURL: 'https://temp.test/1.webp' }]
    });
    tagNailImage.mockResolvedValueOnce({
      name: '热款名',
      color: '红粉色系',
      design: '纯色',
      shape: '中长圆',
      style: '日常百搭'
    });
    cloud.__mock.get.mockRejectedValueOnce(new Error('not found'));
    cloud.__mock.add.mockResolvedValueOnce({ _id: 'xhs-hot-2026-06-06-01' });
    getAll.mockResolvedValueOnce([]);

    const result = await importXhsHotTop10({
      callerOpenid: 'admin',
      scrapeDate: '2026-06-06',
      items: [{
        cover_url: 'https://x.test/a.webp',
        title: '测试款',
        rank: 1,
        interaction_score: 100000,
        note_id: 'note-1',
        note_url: 'https://xhs.test/note-1',
        scrape_date: '2026-06-06'
      }]
    });

    expect(result.ok).toBe(true);
    expect(result.styles).toHaveLength(1);
    expect(result.styles[0]).toMatchObject({
      _id: 'xhs-hot-2026-06-06-01',
      source: 'xhs-hot',
      name: '热款名',
      color: '红粉色系',
      xhs_rank: 1,
      interaction_score: 100000,
      is_active: true
    });
    expect(tagNailImage).toHaveBeenCalledWith('https://temp.test/1.webp');
  });
});

describe('listXhsHotStyles cloud handler', () => {
  let listXhsHotStyles;

  beforeEach(() => {
    jest.resetModules();
    listXhsHotStyles = require('../../cloudfunctions/ops/handlers/listXhsHotStyles').listXhsHotStyles;
  });

  test('returns latest scrape batch sorted by rank', async () => {
    const getAllFn = require('../../cloudfunctions/ops/utils/db').getAll;
    getAllFn.mockResolvedValueOnce([
      { _id: 'a', source: 'xhs-hot', scrape_date: '2026-06-05', xhs_rank: 1, is_active: true, image_file_id: '' },
      { _id: 'b', source: 'xhs-hot', scrape_date: '2026-06-06', xhs_rank: 2, is_active: true, image_file_id: '' },
      { _id: 'c', source: 'xhs-hot', scrape_date: '2026-06-06', xhs_rank: 1, is_active: true, image_file_id: '' }
    ]);
    const result = await listXhsHotStyles();
    expect(result.ok).toBe(true);
    expect(result.scope).toBe('rank');
    expect(result.scrapeDate).toBe('2026-06-06');
    expect(result.styles.map((s) => s._id)).toEqual(['c', 'b']);
  });

  test('library scope returns all batches including inactive', async () => {
    const getAllFn = require('../../cloudfunctions/ops/utils/db').getAll;
    getAllFn.mockResolvedValueOnce([
      { _id: 'old', source: 'xhs-hot', scrape_date: '2026-06-06', xhs_rank: 1, is_active: false, note_id: 'note-a', image_file_id: '' },
      { _id: 'new', source: 'xhs-hot', scrape_date: '2026-06-07', xhs_rank: 1, is_active: true, note_id: 'note-b', image_file_id: '' }
    ]);
    const result = await listXhsHotStyles({ scope: 'library' });
    expect(result.ok).toBe(true);
    expect(result.scope).toBe('library');
    expect(result.styles.map((s) => s._id)).toEqual(['new', 'old']);
  });

  test('library scope dedupes same note_id across batches', async () => {
    const getAllFn = require('../../cloudfunctions/ops/utils/db').getAll;
    getAllFn.mockResolvedValueOnce([
      { _id: 'xhs-hot-2026-06-06-01', source: 'xhs-hot', scrape_date: '2026-06-06', xhs_rank: 1, is_active: false, note_id: '69100476000000000302215e', interaction_score: 146885, image_file_id: '' },
      { _id: 'xhs-hot-2026-06-07-02', source: 'xhs-hot', scrape_date: '2026-06-07', xhs_rank: 2, is_active: true, note_id: '69100476000000000302215e', interaction_score: 147158, image_file_id: '' },
      { _id: 'xhs-hot-2026-06-07-01', source: 'xhs-hot', scrape_date: '2026-06-07', xhs_rank: 1, is_active: true, note_id: '6780f224000000000b022b04', interaction_score: 358728, image_file_id: '' }
    ]);
    const result = await listXhsHotStyles({ scope: 'library' });
    expect(result.ok).toBe(true);
    expect(result.scope).toBe('library');
    expect(result.count).toBe(2);
    expect(result.styles.map((s) => s._id)).toEqual([
      'xhs-hot-2026-06-07-01',
      'xhs-hot-2026-06-07-02'
    ]);
  });

  test('rank scope still returns 10 without dedupe', async () => {
    const getAllFn = require('../../cloudfunctions/ops/utils/db').getAll;
    const batch = [];
    for (let i = 1; i <= 10; i += 1) {
      batch.push({
        _id: 'xhs-hot-2026-06-07-' + String(i).padStart(2, '0'),
        source: 'xhs-hot',
        scrape_date: '2026-06-07',
        xhs_rank: i,
        is_active: true,
        note_id: 'note-' + i,
        image_file_id: ''
      });
    }
    getAllFn.mockResolvedValueOnce(batch);
    const result = await listXhsHotStyles({ scope: 'rank' });
    expect(result.count).toBe(10);
    expect(result.scope).toBe('rank');
  });
});

describe('xhs-hot.service', () => {
  beforeEach(() => {
    jest.resetModules();
    wx.setStorageSync('np_xhs_hot_styles', null);
  });

  test('mapCloudStyleToClientStyle sets xhs-hot badge fields', () => {
    const svc = require('../../services/xhs-hot.service');
    const mapped = svc.mapCloudStyleToClientStyle({
      _id: 'xhs-hot-2026-06-06-01',
      name: '小红书款',
      color: '莫兰蒂色系',
      design: '纯色',
      shape: '中长圆',
      style: '日常百搭',
      image_url: 'https://temp.test/1.webp',
      interaction_score: 120000,
      xhs_rank: 1,
      scrape_date: '2026-06-06',
      source: 'xhs-hot'
    });
    expect(mapped.styleSource).toBe('xhs-hot');
    expect(mapped.heat).toBe(120000);
    expect(mapped.xhsRank).toBe(1);
    expect(mapped.scrapeDate).toBe('2026-06-06');
    expect(mapped.coverUrl).toBe('https://temp.test/1.webp');
  });

  test('library cache keeps inactive styles for style library', () => {
    const svc = require('../../services/xhs-hot.service');
    svc.mergeCachedXhsHotLibraryStyles([
      {
        _id: 'xhs-hot-2026-06-06-01',
        name: '昨日热款',
        is_active: false,
        source: 'xhs-hot',
        scrape_date: '2026-06-06',
        xhs_rank: 1,
        interaction_score: 1000
      }
    ]);
    const styles = svc.getCachedXhsHotLibraryStyles();
    expect(styles).toHaveLength(1);
    expect(styles[0].isActive).toBe(false);
    expect(styles[0].id).toBe('xhs-hot-2026-06-06-01');
  });

  test('mapCloudStyleToClientStyle prefers cloud fileID over HTTPS temp URL', () => {
    const svc = require('../../services/xhs-hot.service');
    const mapped = svc.mapCloudStyleToClientStyle({
      _id: 'xhs-hot-2026-06-06-01',
      name: '小红书款',
      image_url: 'https://636c-cloud1-xxx.tcb.qcloud.la/xhs-hot/01.webp',
      image_file_id: 'cloud://cloud1-xxx.xhs-hot/2026-06-06/01.webp',
      interaction_score: 120000,
      xhs_rank: 1,
      scrape_date: '2026-06-06',
      source: 'xhs-hot'
    });
    expect(mapped.coverUrl).toBe('cloud://cloud1-xxx.xhs-hot/2026-06-06/01.webp');
    expect(mapped.previewUrls).toContain('cloud://cloud1-xxx.xhs-hot/2026-06-06/01.webp');
  });
});

describe('hot-data xhs ranking', () => {
  test('buildXhsHotRanking excludes inactive xhs styles', () => {
    jest.resetModules();
    wx.setStorageSync('np_xhs_hot_styles', {
      scrapeDate: '2026-06-07',
      styles: [
        {
          id: 'xhs-hot-2026-06-07-01',
          title: '今日热款',
          heat: 100,
          xhsRank: 1,
          scrapeDate: '2026-06-07',
          styleSource: 'xhs-hot',
          isActive: true
        },
        {
          id: 'xhs-hot-2026-06-06-01',
          title: '昨日热款',
          heat: 99999,
          xhsRank: 1,
          scrapeDate: '2026-06-06',
          styleSource: 'xhs-hot',
          isActive: false
        }
      ]
    });
    const hotData = require('../../services/hot-data.service');
    const rank = hotData.buildXhsHotRanking();
    expect(rank.items).toHaveLength(1);
    expect(rank.items[0].styleId).toBe('xhs-hot-2026-06-07-01');
  });

  test('buildXhsHotRanking uses cached xhs styles', async () => {
    jest.resetModules();
    wx.setStorageSync('np_xhs_hot_styles', {
      scrapeDate: '2026-06-06',
      styles: [{
        id: 'xhs-hot-2026-06-06-01',
        title: '热款1',
        coverUrl: 'https://temp.test/1.webp',
        heat: 99999,
        xhsRank: 1,
        scrapeDate: '2026-06-06',
        styleSource: 'xhs-hot',
        color: '红粉色系',
        design: '纯色'
      }]
    });
    const hotData = require('../../services/hot-data.service');
    const rank = await hotData.fetchRanking();
    expect(rank.rankType).toBe('xhs-hot');
    expect(rank.updatedAt).toBe('2026-06-06 全网热款 TOP10');
    expect(rank.items).toHaveLength(1);
    expect(rank.items[0].styleSource).toBe('xhs-hot');
  });
});
