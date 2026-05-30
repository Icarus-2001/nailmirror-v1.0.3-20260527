// NailMirror 小程序入口
const { getDeviceLevel } = require('./utils/device');
const logger = require('./utils/logger');
const eventBus = require('./utils/event-bus');
const { initCloud } = require('./utils/cloud');
const { EVT_USER_LOGIN } = require('./config/constants');
// 纳入主包依赖图，避免组件上下文 require tag-vocabulary 报 not defined
require('./config/tag-vocabulary');

App({
  _privacyPopup: null,
  _pendingPrivacyResolve: null,

  globalData: {
    deviceLevel: 'mid',
    systemInfo: null,
    eventBus,
    version: '1.6.0-mvp',
    pendingHdUrl: ''
  },

  registerPrivacyPopup(popup) {
    this._privacyPopup = popup;
    if (this._pendingPrivacyResolve && popup && popup.show) {
      popup.show(this._pendingPrivacyResolve);
      this._pendingPrivacyResolve = null;
    }
  },

  onLaunch() {
    try {
      if (wx.onNeedPrivacyAuthorization) {
        wx.onNeedPrivacyAuthorization((resolve) => {
          const popup = this._privacyPopup;
          if (popup && popup.show) {
            popup.show(resolve);
          } else {
            this._pendingPrivacyResolve = resolve;
          }
        });
      }

      initCloud();
      const info = wx.getSystemInfoSync();
      this.globalData.systemInfo = info;
      this.globalData.deviceLevel = getDeviceLevel();
      logger.info('[app] onLaunch', { deviceLevel: this.globalData.deviceLevel });

      if (wx.getPrivacySetting) {
        wx.getPrivacySetting({
          success: (res) => logger.info('[app] privacy', res),
          fail: (err) => logger.warn('[app] privacy fail', err)
        });
      }
    } catch (e) {
      logger.error('[app] onLaunch error', e);
    }
  },
  onShow() {
    logger.info('[app] onShow');
  },
  onError(err) {
    logger.error('[app] global error', err);
    wx.showToast({ title: '网络波动', icon: 'none' });
  }
});
