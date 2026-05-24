jest.mock('mobx-miniprogram', () => ({ observable: (o) => o, action: (fn) => fn }), { virtual: true });

describe('MerchantService', () => {
  let merchantService;
  beforeEach(() => {
    jest.resetModules();
    merchantService = require('../../services/merchant.service');
  });

  test('getConfig 返回种子', async () => {
    const cfg = await merchantService.getConfig();
    expect(cfg).toBeTruthy();
    expect(cfg.id).toBeTruthy();
  });

  test('saveConfig 修改字段', async () => {
    const r = await merchantService.saveConfig({ phone: '13900000000' });
    expect(r.ok).toBe(true);
    expect(r.merchant.phone).toBe('13900000000');
  });
});
