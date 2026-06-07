const userService = require('../../services/user.service');
const { userStore } = require('../../stores/user.store');
const { BRAND_LOGO } = require('../../config/constants');
const { ensurePrivacyAuthorized, isPrivacyDeclinedError } = require('../../utils/privacy');

Page({
  data: {
    loading: false,
    showProfileDialog: false,
    brandLogo: BRAND_LOGO,
    avatarUrl: '',
    nickname: '',
    avatarChosen: false
  },

  _redirecting: false,
  _from: '',
  _nicknameDraft: '',
  _privacyReady: false,

  onLoad(options) {
    this._from = (options && options.from) || '';
  },

  onReady() {
    this._preparePrivacy();
  },

  async _preparePrivacy() {
    try {
      await ensurePrivacyAuthorized();
      this._privacyReady = true;
    } catch (e) {
      this._privacyReady = false;
    }
  },

  async _ensurePrivacyForProfile() {
    if (this._privacyReady) return true;
    try {
      await ensurePrivacyAuthorized();
      this._privacyReady = true;
      return true;
    } catch (e) {
      wx.showToast({
        title: isPrivacyDeclinedError(e) ? '需同意隐私协议后才能登录' : '隐私授权未完成',
        icon: 'none'
      });
      return false;
    }
  },

  onShow() {
    if (this._redirecting || this.data.loading) return;
    userStore.init();
    if (!userStore.openid) return;
    if (this._from === 'me') return;
    if (this._from === 'merchant') return;
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

  _afterLoginSuccess() {
    if (this._from === 'merchant') {
      this._redirecting = true;
      wx.redirectTo({
        url: '/pages-b/entry/index',
        fail: () => {
          this._redirecting = false;
        }
      });
      return;
    }
    if (this._from === 'me' && getCurrentPages().length > 1) {
      wx.navigateBack();
      return;
    }
    this._goHome();
  },

  async onLogin() {
    if (this.data.loading || this._redirecting) return;
    const ok = await this._ensurePrivacyForProfile();
    if (!ok) return;
    this._nicknameDraft = '';
    this.setData({
      showProfileDialog: true,
      avatarUrl: '',
      nickname: '',
      avatarChosen: false
    });
  },

  onCloseProfileDialog() {
    if (this.data.loading) return;
    this.setData({ showProfileDialog: false });
  },

  onChooseAvatar(e) {
    const avatarUrl = e && e.detail && e.detail.avatarUrl;
    if (!avatarUrl) return;
    this.setData({ avatarUrl, avatarChosen: true });
    if (!wx.saveFile) return;
    wx.saveFile({
      tempFilePath: avatarUrl,
      success: (res) => {
        if (res && res.savedFilePath) {
          this.setData({ avatarUrl: res.savedFilePath, avatarChosen: true });
        }
      }
    });
  },

  _syncNickname(e) {
    const v = ((e && e.detail && e.detail.value) || '').trim();
    this._nicknameDraft = v;
    if (v !== this.data.nickname) {
      this.setData({ nickname: v });
    }
  },

  async onNicknameFocus() {
    await this._ensurePrivacyForProfile();
  },

  onNicknameInput(e) {
    this._syncNickname(e);
  },

  onNicknameBlur(e) {
    this._syncNickname(e);
  },

  onNicknameReview(e) {
    this._syncNickname(e);
  },

  _resolveNickname() {
    const fromDraft = (this._nicknameDraft || this.data.nickname || '').trim();
    if (fromDraft) return Promise.resolve(fromDraft);

    return new Promise((resolve) => {
      const query = wx.createSelectorQuery().in(this);
      query.select('#profileNicknameInput').fields({ properties: ['value'] });
      query.exec((res) => {
        const row = res && res[0];
        const v = (row && row.value ? String(row.value) : '').trim();
        if (v) {
          this._nicknameDraft = v;
          this.setData({ nickname: v });
        }
        resolve(v);
      });
    });
  },

  async onConfirmProfile() {
    if (this.data.loading || this._redirecting) return;
    const privacyOk = await this._ensurePrivacyForProfile();
    if (!privacyOk) return;

    const nickname = await this._resolveNickname();
    if (!nickname) {
      wx.showToast({ title: '请在昵称框点选微信昵称', icon: 'none' });
      return;
    }

    const avatarUrl = this.data.avatarUrl || '';
    if (!this.data.avatarChosen || !avatarUrl) {
      wx.showToast({ title: '请先点击上方圆形头像', icon: 'none' });
      return;
    }

    this.setData({ loading: true, nickname });
    try {
      await userService.login({ nickname, avatarUrl });
      this.setData({ showProfileDialog: false, loading: false });
      wx.showToast({ title: '登录成功', icon: 'success', duration: 1200 });
      this._afterLoginSuccess();
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '登录失败', icon: 'none' });
    }
  },

  onSkip() {
    this._goHome();
  }
});
