// 批次 A · 冒烟测试 2 — AR 试戴主流程
// 覆盖：StyleService.list（首页款式列表） → StyleService.get（点击款式详情） →
//      TryOnService.startAR（AR 启动 / 设备分级生效） → ARRenderer 适配器 mock 渲染 →
//      生成 HD 出片 + history.append 落地（截图保存语义）
//
// 关键断言：
//  1. 首页能取到 ≥1 个款式
//  2. style 的字段满足契约（id/title/coverUrl/styleTags/...）
//  3. startAR 在中端机/高端机返回 sessionId + firstFrameUrl
//  4. startAR 在低端机直接 fallback=true（不进 AR 管线）
//  5. generateHD 返回 hdUrl 形如 https URL
//  6. history.append 成功并生成 id；list() 能取回该条

jest.mock('mobx-miniprogram', () => ({
  observable: (obj) => obj,
  action: (fn) => fn
}), { virtual: true });

const styleService   = require('../../services/style.service');
const tryOnService   = require('../../services/try-on.service');
const historyService = require('../../services/history.service');
const featureFlags   = require('../../config/feature-flags');

describe('[Smoke A2] AR 试戴主流程：首页 → 款式 → AR → 出片 → 历史落地', () => {
  let homeStyle;

  beforeAll(() => {
    // 默认 setup.js 的 wx.getSystemInfoSync 给 ios 14.5 + benchmark -1
    // 走 ios 14+ → high → 不降级；强制 fallback flag 默认 false
    featureFlags.AR_FORCE_FALLBACK = false;
  });

  test('Step1: 首页 StyleService.list 至少返回 1 条款式', async () => {
    const r = await styleService.list({ page: 1, pageSize: 20 });
    expect(Array.isArray(r.items)).toBe(true);
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.total).toBeGreaterThanOrEqual(r.items.length);
    homeStyle = r.items[0];
  });

  test('Step2: 点击款式 → StyleService.get 返回详情，字段契约满足', async () => {
    expect(homeStyle).toBeTruthy();
    const detail = await styleService.get(homeStyle.id);
    expect(detail.id).toBe(homeStyle.id);
    expect(typeof detail.title).toBe('string');
    expect(typeof detail.coverUrl).toBe('string');
    expect(detail.coverUrl).toMatch(/^https?:\/\//);
    expect(Array.isArray(detail.styleTags)).toBe(true);
    expect(Array.isArray(detail.materialTags)).toBe(true);
    expect(Array.isArray(detail.shapeTags)).toBe(true);
  });

  test('Step3: 选甲型后进入 AR → startAR 在高端机返回 sessionId + firstFrameUrl', async () => {
    const shape = (homeStyle.shapeTags && homeStyle.shapeTags[0]) || 'almond';
    const ar = await tryOnService.startAR({ styleId: homeStyle.id, shape });
    // 当前 wx 桩为 ios 14.5 → high；featureFlags.AR_FORCE_FALLBACK=false
    expect(ar).toBeTruthy();
    expect(ar.fallback).toBe(false);
    expect(ar.sessionId).toMatch(/^mock-ar-\d+$/);
    expect(ar.firstFrameUrl).toMatch(/^https?:\/\//);
    expect(ar.firstFrameUrl).toContain(homeStyle.id);
  });

  test('Step3-bis: 低端机 / 强制降级 → startAR 直接 fallback=true，不进 AR 管线', async () => {
    featureFlags.AR_FORCE_FALLBACK = true;
    try {
      const ar = await tryOnService.startAR({ styleId: homeStyle.id, shape: 'almond' });
      expect(ar.fallback).toBe(true);
      expect(ar.sessionId).toBe('');
      expect(ar.reason).toBe('device-low');
    } finally {
      featureFlags.AR_FORCE_FALLBACK = false;
    }
  });

  test('Step4: AR 渲染结果 → generateHD 返回高清 URL（截图保存语义）', async () => {
    const hd = await tryOnService.generateHD({ styleId: homeStyle.id });
    expect(hd.hdUrl).toMatch(/^https?:\/\//);
    expect(hd.hdUrl).toContain(homeStyle.id);
    expect(typeof hd.caption).toBe('string');
    expect(hd.caption.length).toBeGreaterThan(0);
  }, 10000);

  test('Step5: history.append 写入试戴记录 → list() 能取回该条', async () => {
    const before = await historyService.list();
    const beforeLen = before.length;

    const appendRes = await historyService.append({
      styleId: homeStyle.id,
      hdUrl: 'https://picsum.photos/seed/' + homeStyle.id + '-hd/2000/2666',
      mode: 'ar'
    });
    expect(appendRes.ok).toBe(true);
    expect(appendRes.id).toMatch(/^h-\d+$/);

    const after = await historyService.list();
    expect(after.length).toBe(beforeLen + 1);
    const found = after.find((x) => x.id === appendRes.id);
    expect(found).toBeTruthy();
    expect(found.styleId).toBe(homeStyle.id);
    expect(found.mode).toBe('ar');
  });

  test('Step6: startAR 缺 styleId → 抛 NOT_FOUND（参数校验）', async () => {
    await expect(tryOnService.startAR({})).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
