jest.mock('mobx-miniprogram', () => ({ observable: (o) => o, action: (fn) => fn }), { virtual: true });

describe('UserService', () => {
  let userService;
  beforeEach(() => {
    jest.resetModules();
    userService = require('../../services/user.service');
  });

  test('login 返回 user 对象 with openid', async () => {
    const u = await userService.login();
    expect(u.openid).toBeTruthy();
    expect(u.role).toBe('c');
  });

  test('login 优先调用云函数返回真实 openid', async () => {
    jest.resetModules();
    const callFunction = jest.fn().mockResolvedValue({
      code: 0,
      data: {
        openid: 'openid-real-001',
        role: 'c',
        membershipLevel: 0,
        dailyFreeHDLeft: 2
      }
    });
    jest.doMock('../../utils/cloud', () => ({
      callFunction,
      isCloudReady: () => true
    }));
    userService = require('../../services/user.service');

    const u = await userService.login();

    expect(callFunction).toHaveBeenCalledWith('login', { action: 'login' });
    expect(u.openid).toBe('openid-real-001');
  });
});
