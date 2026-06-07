// 用户隐私授权（相册/相机）— 保存/选图前主动拉起，避免与 showLoading mask 叠层卡死

function _getAppSafe() {
  try {
    return getApp();
  } catch (e) {
    return null;
  }
}

function _showPrivacyPopup(retry) {
  return new Promise((resolve, reject) => {
    const app = _getAppSafe();
    const popup = app && app._privacyPopup;
    if (!popup || !popup.show) {
      const n = retry || 0;
      if (n < 6) {
        setTimeout(() => {
          _showPrivacyPopup(n + 1).then(resolve).catch(reject);
        }, 80);
        return;
      }
      reject(new Error('需同意隐私协议后才能继续'));
      return;
    }
    popup.show((result) => {
      if (result && result.event === 'disagree') {
        reject(new Error('需同意隐私协议后才能继续'));
        return;
      }
      if (result && (result.event === 'agree' || result.buttonId === 'privacy-agree-btn')) {
        resolve();
        return;
      }
      reject(new Error('需同意隐私协议后才能继续'));
    });
  });
}

function _getPrivacySettingAsync() {
  return new Promise((resolve) => {
    if (!wx.getPrivacySetting) {
      resolve({ needAuthorization: false });
      return;
    }
    wx.getPrivacySetting({
      success: (res) => resolve(res || { needAuthorization: false }),
      fail: () => resolve({ needAuthorization: false }),
    });
  });
}

/**
 * 仅查询是否仍需隐私授权（页面 onReady 用，不触发授权弹窗）
 */
async function checkPrivacyNeeded() {
  const setting = await _getPrivacySettingAsync();
  return !!(setting && setting.needAuthorization);
}

/**
 * 须在用户点击后调用（登录按钮、选头像、选图等）
 */
async function ensurePrivacyAuthorized() {
  const setting = await _getPrivacySettingAsync();
  if (!setting.needAuthorization) return;

  if (wx.requirePrivacyAuthorize) {
    await new Promise((resolve, reject) => {
      wx.requirePrivacyAuthorize({
        success: () => resolve(),
        fail: () => _showPrivacyPopup().then(resolve).catch(reject),
      });
    });
    return;
  }

  await _showPrivacyPopup();
}

function isPrivacyDeclinedError(err) {
  const msg = (err && (err.message || err.errMsg)) || '';
  return msg.indexOf('隐私') > -1 || msg.indexOf('同意') > -1;
}

module.exports = {
  checkPrivacyNeeded,
  ensurePrivacyAuthorized,
  isPrivacyDeclinedError,
};
