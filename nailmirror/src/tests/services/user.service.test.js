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

    const profile = { nickname: '微信用户', avatarUrl: 'wxfile://avatar.png' };
    const u = await userService.login(profile);

    expect(callFunction).toHaveBeenCalledWith('login', {
      action: 'login',
      nickname: profile.nickname,
      avatarUrl: profile.avatarUrl
    });
    expect(u.openid).toBe('openid-real-001');
  });

  test('login Mock 降级时保留弹层传入的头像昵称', async () => {
    jest.resetModules();
    jest.doMock('../../utils/cloud', () => ({
      callFunction: jest.fn(),
      isCloudReady: () => false
    }));
    userService = require('../../services/user.service');

    const profile = { nickname: '小镜子', avatarUrl: 'wxfile://avatar-mock.png' };
    const u = await userService.login(profile);

    expect(u.nickname).toBe(profile.nickname);
    expect(u.avatarUrl).toBe(profile.avatarUrl);
  });
});
