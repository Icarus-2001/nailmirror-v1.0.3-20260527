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
});
