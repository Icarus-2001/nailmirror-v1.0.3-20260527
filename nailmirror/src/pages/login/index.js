const userService = require('../../services/user.service');
const { userStore } = require('../../stores/user.store');
const { BRAND_LOGO } = require('../../config/constants');

Page({
  data: {
    loading: false,
    brandLogo: BRAND_LOGO
  },

  _redirecting: false,

  onShow() {
    if (this._redirecting || this.data.loading) return;
    userStore.init();
    if (!userStore.openid) return;
    const app = getApp();
    if (app.globalData.skipLoginAutoRedirect) {
      app.globalData.skipLoginAutoRedirect = false;
      return;
    }
    this._goHome();
  },

  _goHome() {
    if (this._redirecting) return;
    this._redirecting = true;
    wx.switchTab({
      url: '/pages/home/index',
      fail: () => {
        this._redirecting = false;
      }
    });
  },

  async onLogin() {
    if (this.data.loading || this._redirecting) return;
    this.setData({ loading: true });
    try {
      await userService.login();
      wx.showToast({ title: '登录成功', icon: 'success', duration: 1200 });
      this._goHome();
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '登录失败', icon: 'none' });
    }
  },

  onSkip() {
    this._goHome();
  }
});
