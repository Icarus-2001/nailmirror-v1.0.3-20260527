const userService = require('../../services/user.service');
const { userStore } = require('../../stores/user.store');
const { BRAND_LOGO } = require('../../config/constants');

Page({
  data: {
    loading: false,
    showProfileDialog: false,
    brandLogo: BRAND_LOGO,
    avatarUrl: '',
    nickname: ''
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

  onLogin() {
    if (this.data.loading || this._redirecting) return;
    this.setData({ showProfileDialog: true });
  },

  onCloseProfileDialog() {
    if (this.data.loading) return;
    this.setData({ showProfileDialog: false });
  },

  onChooseAvatar(e) {
    const avatarUrl = e && e.detail && e.detail.avatarUrl;
    if (!avatarUrl) return;
    this.setData({ avatarUrl });
    if (!wx.saveFile) return;
    wx.saveFile({
      tempFilePath: avatarUrl,
      success: (res) => {
        if (res && res.savedFilePath) this.setData({ avatarUrl: res.savedFilePath });
      }
    });
  },

  onNicknameInput(e) {
    this.setData({ nickname: (e && e.detail && e.detail.value) || '' });
  },

  async onConfirmProfile() {
    if (this.data.loading || this._redirecting) return;
    const nickname = (this.data.nickname || '').trim();
    if (!nickname) {
      wx.showToast({ title: '请确认微信昵称', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    try {
      await userService.login({
        nickname,
        avatarUrl: this.data.avatarUrl || ''
      });
      this.setData({ showProfileDialog: false, loading: false });
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
