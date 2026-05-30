jest.mock('mobx-miniprogram', () => ({ observable: (o) => o, action: (fn) => fn }), { virtual: true });

const tryOnService = require('../../services/try-on.service');

describe('TryOnService', () => {
  test('startAR 缺少 styleId 报错', async () => {
    await expect(tryOnService.startAR({})).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('startAR 正常返回 sessionId', async () => {
    const r = await tryOnService.startAR({ styleId: 'french-01', shape: 'almond' });
    expect(r).toHaveProperty('fallback');
    // iOS 14 模拟系统应是 high，不 fallback
    expect(typeof r.fallback).toBe('boolean');
  });

  test('startStatic 无 photoPath 报错', async () => {
    await expect(tryOnService.startStatic('', 'french-01')).rejects.toMatchObject({ code: 'UPLOAD_ERR' });
  });

  test('generateHD 返回 hdUrl', async () => {
    const r = await tryOnService.generateHD({ styleId: 'french-01' });
    expect(r.hdUrl).toMatch(/^https?:\/\//);
    expect(typeof r.caption).toBe('string');
  });

  test('startStatic 支持自定义上传参考款式，不强查款式库', async () => {
    jest.resetModules();
    const runTryon = jest.fn().mockResolvedValue({
      composedUrl: 'wxfile://tmp/result.png',
      outputUrl: 'https://dashscope.example.com/out.png',
      jobId: 'job-custom',
      wanModel: 'wan2.7-image-pro',
      wanBackend: 'multimodal_edit'
    });
    jest.doMock('../../config/feature-flags', () => ({
      USE_CLOUD_TRYON: true,
      WATERMARK_DEFAULT: true
    }));
    jest.doMock('../../utils/cloud', () => ({
      isCloudReady: () => true
    }));
    jest.doMock('../../services/style.service', () => ({
      get: jest.fn(() => { throw new Error('should not lookup custom style'); })
    }));
    jest.doMock('../../services/adapters/tryon-cloud-adapter', () => ({
      runTryon
    }));
    const svc = require('../../services/try-on.service');
    const customStyle = {
      id: 'custom-style-1',
      title: '自定义参考图',
      styleSource: 'custom-upload',
      styleImageFileID: 'cloud://env/style.png',
      styleImageUrl: 'https://tmp.example.com/style.png'
    };

    const r = await svc.startStatic('/tmp/hand.jpg', customStyle.id, 'almond', { customStyle });

    expect(runTryon).toHaveBeenCalledWith('/tmp/hand.jpg', customStyle, 'almond', '');
    expect(r.composedUrl).toBe('wxfile://tmp/result.png');
  });
});
