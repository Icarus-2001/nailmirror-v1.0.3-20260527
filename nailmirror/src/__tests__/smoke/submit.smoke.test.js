// 批次 A · 冒烟测试 3 — "订单提交"流程（MVP 映射版）
//
// ⚠️ 适配说明：批次 A 原描述"订单提交流程（OrderService）"。
// 对照 PRD / ARCHITECTURE / IMPL_SUMMARY，本 MVP 并不包含订单/支付子系统，
// "购买下单"被显式映射为"加入心愿单 + 历史落地 + 商家私聊联系"三步（PRD P0 §5 商家到店转化）。
// 因此本用例覆盖：
//   出片结果 → FavoriteService.add (心愿单) →
//   HistoryService.append (订单语义：一条试戴记录即一条意向单) →
//   MerchantService.getConfig (取到商家私聊入口：wxContact/phone)
// 成功路径即"订单确认 + 提交 + 订单成功"语义闭环。
//
// 若后续迭代新增 OrderService，应在 __tests__/smoke/ 增量 order.smoke.test.js，
// 本用例继续覆盖 MVP 心愿单路径。

jest.mock('mobx-miniprogram', () => ({
  observable: (obj) => obj,
  action: (fn) => fn
}), { virtual: true });

const styleService    = require('../../services/style.service');
const favoriteService = require('../../services/favorite.service');
const historyService  = require('../../services/history.service');
const merchantService = require('../../services/merchant.service');
const eventBus        = require('../../utils/event-bus');
const {
  EVT_NAIL_STYLE_FAVORITED,
  EVT_TRY_ON_HISTORY_APPENDED
} = require('../../config/constants');

describe('[Smoke A3] 订单提交流程（MVP 映射：心愿单 + 历史 + 商家联系）', () => {
  let targetStyle;

  beforeAll(async () => {
    const r = await styleService.list({ page: 1, pageSize: 5 });
    expect(r.items.length).toBeGreaterThan(0);
    targetStyle = r.items[0];
  });

  test('Step1: 从试戴结果加入心愿单 → FavoriteService.add 成功，事件派发', async () => {
    const events = [];
    const off = eventBus.on(EVT_NAIL_STYLE_FAVORITED, (id) => events.push(id));
    try {
      const res = await favoriteService.add(targetStyle.id);
      expect(res.ok).toBe(true);
      // 查 favoriteStore 状态
      expect(favoriteService.has(targetStyle.id)).toBe(true);
      // 事件至少派发一次，含 styleId
      expect(events).toContain(targetStyle.id);
    } finally {
      if (typeof off === 'function') off();
    }
  });

  test('Step2: 收藏列表 list() 必须包含刚收藏的款式', async () => {
    const items = await favoriteService.list();
    const found = items.find((s) => s && s.id === targetStyle.id);
    expect(found).toBeTruthy();
    expect(typeof found.title).toBe('string');
  });

  test('Step3: HistoryService.append 作为"订单提交"语义 → 生成订单号（id）+ 派发事件', async () => {
    const events = [];
    const off = eventBus.on(EVT_TRY_ON_HISTORY_APPENDED, (r) => events.push(r));
    try {
      const r = await historyService.append({
        styleId: targetStyle.id,
        mode: 'ar',
        hdUrl: 'https://picsum.photos/seed/' + targetStyle.id + '-hd/2000/2666',
        note: 'smoke-order'
      });
      expect(r.ok).toBe(true);
      // 订单号
      expect(r.id).toMatch(/^h-\d+$/);
      expect(events.length).toBe(1);
      expect(events[0].id).toBe(r.id);
      expect(events[0].styleId).toBe(targetStyle.id);
    } finally {
      if (typeof off === 'function') off();
    }
  });

  test('Step4: 订单成功页 → MerchantService.getConfig 返回私聊/电话入口', async () => {
    const merchant = await merchantService.getConfig();
    expect(merchant).toBeTruthy();
    expect(typeof merchant.id).toBe('string');
    expect(typeof merchant.name).toBe('string');
    // 商家必须提供至少一种联系方式（架构 §4 商家私域导流）
    const hasContact =
      !!merchant.phone ||
      !!merchant.wxContact ||
      !!merchant.wecomQrUrl;
    expect(hasContact).toBe(true);
  });

  test('Step5: 订单去重幂等 → 重复 add 同一 styleId 仅计一次', async () => {
    await favoriteService.add(targetStyle.id);
    await favoriteService.add(targetStyle.id);
    const items = await favoriteService.list();
    const count = items.filter((s) => s && s.id === targetStyle.id).length;
    expect(count).toBe(1);
  });

  test('Step6: 订单取消 → FavoriteService.remove 后 has=false', async () => {
    const r = await favoriteService.remove(targetStyle.id);
    expect(r.ok).toBe(true);
    expect(favoriteService.has(targetStyle.id)).toBe(false);
  });
});
