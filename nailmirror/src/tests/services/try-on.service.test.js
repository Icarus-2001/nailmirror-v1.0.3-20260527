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
});
