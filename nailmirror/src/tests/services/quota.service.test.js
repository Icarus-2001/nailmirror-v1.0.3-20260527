jest.mock('mobx-miniprogram', () => ({ observable: (o) => o, action: (fn) => fn }), { virtual: true });
jest.mock('../../config/feature-flags', () => ({ ENABLE_FREE_HD_QUOTA: true }));

describe('quota.service', () => {  let quotaService;
  let userStore;

  beforeEach(() => {
    jest.resetModules();
    quotaService = require('../../services/quota.service');
    userStore = require('../../stores/user.store').userStore;
    userStore.dailyFreeHDLeft = 2;
  });

  test('assertFreeHD 额度为 0 时抛 QUOTA_EXCEEDED', () => {
    const { safeSet } = require('../../utils/storage');
    const { STORAGE_DAILY_QUOTA } = require('../../config/constants');
    const d = new Date();
    const day = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    safeSet(STORAGE_DAILY_QUOTA, { day, left: 0 });
    try {
      quotaService.assertFreeHD();
      throw new Error('expected throw');
    } catch (e) {
      expect(e.code).toBe('QUOTA_EXCEEDED');
    }
  });

  test('consumeFreeHDOnSuccess 扣减额度', () => {
    userStore.dailyFreeHDLeft = 2;
    expect(quotaService.consumeFreeHDOnSuccess()).toBe(true);
    expect(userStore.dailyFreeHDLeft).toBe(1);
  });
});

describe('quota.service（限额关闭）', () => {
  test('关闭时不校验、不扣减', () => {
    jest.resetModules();
    jest.doMock('../../config/feature-flags', () => ({ ENABLE_FREE_HD_QUOTA: false }));
    const quotaService = require('../../services/quota.service');
    const { userStore } = require('../../stores/user.store');
    userStore.dailyFreeHDLeft = 0;
    expect(quotaService.isFreeHDQuotaEnabled()).toBe(false);
    expect(() => quotaService.assertFreeHD()).not.toThrow();
    expect(quotaService.consumeFreeHDOnSuccess()).toBe(true);
    expect(userStore.dailyFreeHDLeft).toBe(0);
  });
});
