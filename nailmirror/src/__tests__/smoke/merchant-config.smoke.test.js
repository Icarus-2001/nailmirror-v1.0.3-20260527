// 商家店铺信息 — MerchantService 云端契约冒烟（mock cloudUtil）

jest.mock('mobx-miniprogram', () => ({
  observable: (obj) => obj,
  action: (fn) => fn,
}), { virtual: true });

jest.mock('../../utils/cloud', () => ({
  isCloudReady: jest.fn(() => true),
  callFunction: jest.fn(),
}));

const cloudUtil = require('../../utils/cloud');
const merchantService = require('../../services/merchant.service');

describe('[Smoke] 商家店铺信息：MerchantService 云端读写', () => {
  beforeEach(() => {
    cloudUtil.callFunction.mockReset();
  });

  test('getConfig maps cloud profile to page fields', async () => {
    cloudUtil.callFunction.mockResolvedValueOnce({
      ok: true,
      profile: {
        storeName: '星辰美甲·国贸店',
        phone: '13800138001',
        businessHours: '10:00-22:00',
        province: '北京市',
        city: '北京市',
      },
      editPolicy: { canEdit: true, nextEditableAt: null },
    });

    const cfg = await merchantService.getConfig();
    expect(cfg.name).toBe('星辰美甲·国贸店');
    expect(cfg.phone).toBe('13800138001');
    expect(cfg.businessHours).toBe('10:00-22:00');
    expect(cfg.canEdit).toBe(true);
    expect(cloudUtil.callFunction).toHaveBeenCalledWith('ops', expect.objectContaining({
      action: 'getMerchantStoreProfile',
    }));
  });

  test('saveConfig calls updateMerchantStoreProfile and returns merged cfg', async () => {
    cloudUtil.callFunction.mockResolvedValueOnce({
      ok: true,
      profile: {
        storeName: '新店名',
        phone: '13900139001',
        businessHours: '09:00-21:00',
      },
      editPolicy: { canEdit: false, nextEditableAt: '2026-07-07' },
    });

    const res = await merchantService.saveConfig({
      name: '新店名',
      phone: '13900139001',
      businessHours: '09:00-21:00',
    });
    expect(res.ok).toBe(true);
    expect(res.merchant.name).toBe('新店名');
    expect(res.merchant.canEdit).toBe(false);
    expect(cloudUtil.callFunction).toHaveBeenCalledWith('ops', expect.objectContaining({
      action: 'updateMerchantStoreProfile',
      storeName: '新店名',
      phone: '13900139001',
      businessHours: '09:00-21:00',
    }));
  });

  test('saveConfig throws when cloud returns error', async () => {
    cloudUtil.callFunction.mockResolvedValueOnce({
      ok: false,
      error: '店铺信息每月仅可修改一次，请于 2026-07-07 后再试',
    });
    await expect(merchantService.saveConfig({ name: '店', phone: '13800138001' }))
      .rejects.toThrow(/每月仅可修改一次/);
  });
});
