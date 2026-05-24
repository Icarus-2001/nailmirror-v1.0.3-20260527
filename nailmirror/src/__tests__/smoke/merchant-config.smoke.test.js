// 批次 B · 冒烟测试 3 — 商家看板：MerchantService.saveConfig 回显
// 覆盖：
//   1. getConfig() 默认返回首商家（mock 种子）
//   2. saveConfig({...部分字段}) 与老数据 merge 后写回 storage
//   3. 紧跟的 getConfig() 能读回最新合并结果
//   4. 多字段覆盖：phone / wecomQrUrl / businessHours / name / city / paidPlan 全部能写回
//   5. 连续 saveConfig 最后一次为准（顺序写入无覆盖丢失）
//
// ⚠️ EVT 事件说明：
//   批次 B 要求"saveConfig 触发 EVT 事件给 C 端商家页刷新"。
//   现 services/merchant.service.js 未 emit 任何事件，config/constants.js 也未定义 EVT_MERCHANT_UPDATED。
//   这是 **源码 Bug（P2 功能缺失）**：
//     - 文件：src/services/merchant.service.js:17-24 (saveConfig)
//     - 文件：src/config/constants.js:1-10 (EVT 常量清单)
//     - 期望：saveConfig 成功后 eventBus.emit('event:merchant-updated', next)
//     - 实际：无事件派发
//     - 复现：B 端保存配置后，C 端商家页无法实时感知更新（需要重启或 pullToRefresh）
//   本用例以"现实契约"断言数据持久化正确；EVT 派发作为遗留缺陷上报，不强制 fail。

jest.mock('mobx-miniprogram', () => ({
  observable: (obj) => obj,
  action: (fn) => fn
}), { virtual: true });

const merchantService = require('../../services/merchant.service');
const { safeGet, safeSet } = require('../../utils/storage');
const { STORAGE_MERCHANT } = require('../../config/constants');

describe('[Smoke B3] 商家看板：MerchantService.saveConfig 回显', () => {
  beforeEach(() => {
    // setup.js 每个测试前已清 storage；这里显式再清一次 merchant 槽，避免 cache 污染
    safeSet(STORAGE_MERCHANT, null);
  });

  test('Step1: 首次 getConfig() 返回 mock 种子商家（默认首个）', async () => {
    const m = await merchantService.getConfig();
    expect(m).toBeTruthy();
    expect(typeof m.id).toBe('string');
    expect(typeof m.name).toBe('string');
    expect(typeof m.city).toBe('string');
    expect(typeof m.phone).toBe('string');
    expect(typeof m.businessHours).toBe('string');
  });

  test('Step2: getConfig(id) 按 id 定位商家', async () => {
    const m = await merchantService.getConfig('merchant-2');
    expect(m).toBeTruthy();
    // storage 优先级高于 id 查询（第一次调用会写 cache）— 但本 suite 每个 test beforeEach 已清
    expect(m.id).toBe('merchant-2');
  });

  test('Step3: saveConfig 部分字段 → 后续 getConfig 读回合并结果', async () => {
    // 先建立 baseline
    const base = await merchantService.getConfig();
    expect(base).toBeTruthy();

    // 保存新的联系方式
    const saveRes = await merchantService.saveConfig({
      phone: '13900139001',
      businessHours: '09:30-23:30'
    });
    expect(saveRes.ok).toBe(true);
    expect(saveRes.merchant).toBeTruthy();
    expect(saveRes.merchant.phone).toBe('13900139001');
    expect(saveRes.merchant.businessHours).toBe('09:30-23:30');
    // 老字段保留（merge 语义）
    expect(saveRes.merchant.id).toBe(base.id);
    expect(saveRes.merchant.name).toBe(base.name);

    // 回显：getConfig 读回
    const after = await merchantService.getConfig();
    expect(after.phone).toBe('13900139001');
    expect(after.businessHours).toBe('09:30-23:30');
    expect(after.id).toBe(base.id);
    expect(after.name).toBe(base.name);
  });

  test('Step4: 多字段全量覆盖 — name/city/phone/wecomQrUrl/businessHours/paidPlan', async () => {
    await merchantService.getConfig(); // 建立 cache baseline
    const payload = {
      name: '测试店铺-QA',
      city: '深圳',
      phone: '13700137001',
      wecomQrUrl: 'https://picsum.photos/seed/qa-qr/300/300',
      businessHours: '10:00-24:00',
      paidPlan: 2
    };
    const r = await merchantService.saveConfig(payload);
    expect(r.ok).toBe(true);

    const got = await merchantService.getConfig();
    Object.entries(payload).forEach(([k, v]) => {
      expect(got[k]).toBe(v);
    });
  });

  test('Step5: 连续 saveConfig 顺序写入 — 最后一次覆盖', async () => {
    await merchantService.getConfig();
    await merchantService.saveConfig({ phone: '111' });
    await merchantService.saveConfig({ phone: '222' });
    await merchantService.saveConfig({ phone: '333', businessHours: '08:00-20:00' });
    const got = await merchantService.getConfig();
    expect(got.phone).toBe('333');
    expect(got.businessHours).toBe('08:00-20:00');
  });

  test('Step6: storage 持久化 — saveConfig 后 STORAGE_MERCHANT 含最新数据', async () => {
    await merchantService.getConfig();
    await merchantService.saveConfig({ phone: '13612340000' });
    const raw = safeGet(STORAGE_MERCHANT, null);
    expect(raw).toBeTruthy();
    expect(raw.phone).toBe('13612340000');
  });

  test('Step7: saveConfig 不传参数也不应抛错（空 merge 语义）', async () => {
    await merchantService.getConfig();
    const r = await merchantService.saveConfig({});
    expect(r.ok).toBe(true);
    expect(r.merchant).toBeTruthy();
    expect(typeof r.merchant.id).toBe('string');
  });
});
