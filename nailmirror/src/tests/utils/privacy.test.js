describe('privacy.util', () => {
  beforeEach(() => {
    jest.resetModules();
    global.getApp = () => ({
      _privacyPopup: {
        show(fn) {
          fn({ buttonId: 'privacy-agree-btn', event: 'agree' });
        }
      }
    });
    global.wx.getPrivacySetting = jest.fn(({ success }) => {
      success({ needAuthorization: true });
    });
    global.wx.requirePrivacyAuthorize = undefined;
  });

  test('needAuthorization 时走弹窗并 resolve', async () => {
    const { ensurePrivacyAuthorized } = require('../../utils/privacy');
    await expect(ensurePrivacyAuthorized()).resolves.toBeUndefined();
  });

  test('用户拒绝时 reject', async () => {
    global.getApp = () => ({
      _privacyPopup: {
        show(fn) {
          fn({ event: 'disagree' });
        }
      }
    });
    const { ensurePrivacyAuthorized, isPrivacyDeclinedError } = require('../../utils/privacy');
    await expect(ensurePrivacyAuthorized()).rejects.toThrow('隐私');
    expect(isPrivacyDeclinedError(new Error('需同意隐私协议后才能继续'))).toBe(true);
  });
});
