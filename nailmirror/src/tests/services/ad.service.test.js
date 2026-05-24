jest.mock('mobx-miniprogram', () => ({ observable: (o) => o, action: (fn) => fn }), { virtual: true });

describe('AdService', () => {
  let adService;
  beforeEach(() => {
    jest.resetModules();
    global.wx.createRewardedVideoAd = null;
    adService = require('../../services/ad.service');
  });

  test('Mock 环境 showRewardedAd 返回 completed=true', async () => {
    const r = await adService.showRewardedAd();
    expect(r.completed).toBe(true);
  });
});
