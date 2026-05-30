jest.mock('mobx-miniprogram', () => ({ observable: (o) => o, action: (fn) => fn }), { virtual: true });

describe('HistoryService', () => {
  let historyService;

  beforeEach(() => {
    jest.resetModules();
    historyService = require('../../services/history.service');
  });

  test('list 默认空列表（无 mock seed）', async () => {
    const list = await historyService.list();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(0);
  });

  test('append 后 list 含款式标题与国内时间展示字段', async () => {
    await historyService.append({
      userOpenid: 'u',
      styleId: 'real-1',
      nailShape: 'almond',
      mode: 'static',
      thumbUrl: 'https://example.com/thumb.jpg',
      hdUrl: 'https://example.com/hd.jpg'
    });
    const list = await historyService.list();
    expect(list.length).toBe(1);
    expect(list[0].styleTitle).toBeTruthy();
    expect(list[0].displayTagsText).toBeTruthy();
    expect(list[0].createdAtText).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    expect(list[0].metaLine).toContain('静态试戴');
  });

  test('append 自定义上传款式时保留标题和来源，不强制查款式库', async () => {
    await historyService.append({
      userOpenid: 'openid-real-001',
      styleId: 'custom-style-123',
      styleSource: 'custom-upload',
      styleTitle: '自定义参考图',
      displayTags: ['上传参考图'],
      referenceStyleUrl: 'cloud://env/custom-style.png',
      nailShape: 'almond',
      mode: 'static',
      thumbUrl: 'cloud://env/result.png',
      hdUrl: 'cloud://env/result.png'
    });

    const list = await historyService.list();

    expect(list).toHaveLength(1);
    expect(list[0].styleId).toBe('custom-style-123');
    expect(list[0].styleSource).toBe('custom-upload');
    expect(list[0].styleTitle).toBe('自定义参考图');
    expect(list[0].displayTagsText).toContain('上传参考图');
  });

  test('加载时剔除 legacy mock（picsum / h-100x）', async () => {
    const { STORAGE_HISTORIES } = require('../../config/constants');
    wx.setStorageSync(STORAGE_HISTORIES, [
      {
        id: 'h-1001',
        styleId: 'french-01',
        thumbUrl: 'https://picsum.photos/seed/h1001/400/533',
        createdAt: '2026-05-05 20:11'
      },
      {
        id: 'h-real',
        styleId: 'real-1',
        thumbUrl: 'cloud://x/thumb.jpg',
        createdAt: new Date().toISOString()
      }
    ]);
    jest.resetModules();
    historyService = require('../../services/history.service');
    const list = await historyService.list();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe('h-real');
  });

  test('reGenerate 返回 hdUrl', async () => {
    const { id } = await historyService.append({
      userOpenid: 'u',
      styleId: 'real-1',
      nailShape: 'almond',
      mode: 'static',
      thumbUrl: 'https://example.com/thumb.jpg',
      hdUrl: 'https://example.com/hd.jpg'
    });
    const r = await historyService.reGenerate(id);
    expect(r.hdUrl).toMatch(/^https?:\/\//);
  });
});
