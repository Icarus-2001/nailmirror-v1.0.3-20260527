const { userStore } = require('../../stores/user.store');
const { BRAND_LOGO } = require('../../config/constants');
const { ensurePrivacyAuthorized, isPrivacyDeclinedError } = require('../../utils/privacy');
const userService = require('../../services/user.service');

Page({
  data: {
    user: null,
    needLogin: true,
    brandLogo: BRAND_LOGO,
    showProfileDialog: false,
    dialogAvatarUrl: '',
    dialogNickname: '',
    avatarChosen: false,
    profileLoading: false
  },

  _nicknameDraft: '',
  _privacyReady: false,

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

  async _ensurePrivacy() {
    if (this._privacyReady) return true;
    try {
      await ensurePrivacyAuthorized();
      this._privacyReady = true;
      return true;
    } catch (e) {
      wx.showToast({
        title: isPrivacyDeclinedError(e) ? '需同意隐私协议后才能继续' : '隐私授权未完成',
        icon: 'none'
      });
      return false;
    }
  },

  async onShow() {
    userStore.init();
    this._syncUserView();
  },

  _syncUserView() {
    const loggedIn = !!userStore.openid;
    this.setData({
      needLogin: !loggedIn,
      user: {
        nickname: loggedIn ? (userStore.nickname || '微信用户') : '未登录',
        avatarUrl: userStore.avatarUrl || BRAND_LOGO,
        role: userStore.role,
        membershipLevel: userStore.membershipLevel
      }
    });
  },

  onGoLogin() {
    if (!this.data.needLogin) return;
    this._openProfileDialog();
  },

  async onTapAvatar() {
    await this._openProfileDialog();
  },

  async _openProfileDialog() {
    const ok = await this._ensurePrivacy();
    if (!ok) return;
    const loggedIn = !!userStore.openid;
    this._nicknameDraft = loggedIn ? (userStore.nickname || '') : '';
    this.setData({
      showProfileDialog: true,
      dialogAvatarUrl: loggedIn ? (userStore.avatarUrl || '') : '',
      dialogNickname: this._nicknameDraft,
      avatarChosen: !!(loggedIn && userStore.avatarUrl && userStore.avatarUrl !== BRAND_LOGO)
    });
  },

  onCloseProfileDialog() {
    if (this.data.profileLoading) return;
    this.setData({ showProfileDialog: false });
  },

  onChooseAvatar(e) {
    const avatarUrl = e && e.detail && e.detail.avatarUrl;
    if (!avatarUrl) return;
    this.setData({ dialogAvatarUrl: avatarUrl, avatarChosen: true });
    if (!wx.saveFile) return;
    wx.saveFile({
      tempFilePath: avatarUrl,
      success: (res) => {
        if (res && res.savedFilePath) {
          this.setData({ dialogAvatarUrl: res.savedFilePath, avatarChosen: true });
        }
      }
    });
  },

  async onChooseAvatarFromAlbum() {
    const ok = await this._ensurePrivacy();
    if (!ok) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      sizeType: ['compressed'],
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0];
        const path = file && (file.tempFilePath || file.path);
        if (!path) return;
        this.setData({ dialogAvatarUrl: path, avatarChosen: true });
      }
    });
  },

  _syncNickname(e) {
    const v = ((e && e.detail && e.detail.value) || '').trim();
    this._nicknameDraft = v;
    if (v !== this.data.dialogNickname) {
      this.setData({ dialogNickname: v });
    }
  },

  async onNicknameFocus() {
    await this._ensurePrivacy();
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
    const fromDraft = (this._nicknameDraft || this.data.dialogNickname || '').trim();
    if (fromDraft) return Promise.resolve(fromDraft);

    return new Promise((resolve) => {
      const query = wx.createSelectorQuery().in(this);
      query.select('#meProfileNicknameInput').fields({ properties: ['value'] });
      query.exec((res) => {
        const row = res && res[0];
        const v = (row && row.value ? String(row.value) : '').trim();
        if (v) {
          this._nicknameDraft = v;
          this.setData({ dialogNickname: v });
        }
        resolve(v);
      });
    });
  },

  async onConfirmProfile() {
    if (this.data.profileLoading) return;
    const privacyOk = await this._ensurePrivacy();
    if (!privacyOk) return;

    const nickname = await this._resolveNickname();
    if (!nickname) {
      wx.showToast({ title: '请在昵称框点选微信昵称', icon: 'none' });
      return;
    }

    const avatarUrl = this.data.dialogAvatarUrl || '';
    if (!this.data.avatarChosen || !avatarUrl) {
      wx.showToast({ title: '请先选择头像', icon: 'none' });
      return;
    }

    this.setData({ profileLoading: true, dialogNickname: nickname });
    try {
      if (this.data.needLogin) {
        await userService.login({ nickname, avatarUrl });
        wx.showToast({ title: '登录成功', icon: 'success', duration: 1200 });
      } else {
        userStore.setUser({ nickname, avatarUrl });
        wx.showToast({ title: '资料已更新', icon: 'success', duration: 1200 });
      }
      this.setData({ showProfileDialog: false, profileLoading: false });
      this._syncUserView();
    } catch (e) {
      this.setData({ profileLoading: false });
      wx.showToast({
        title: this.data.needLogin ? '登录失败' : '保存失败',
        icon: 'none'
      });
    }
  },

  onAvatarError() {
    const user = Object.assign({}, this.data.user || {}, { avatarUrl: BRAND_LOGO });
    this.setData({ user });
  },

  onGoHistory() { wx.navigateTo({ url: '/pages/me-history/index' }); },
  onGoFavorite() { wx.navigateTo({ url: '/pages/me-favorite/index' }); },
  onGoMembership() { wx.navigateTo({ url: '/pages/me-membership/index' }); },
  async onGoMerchant() {
    userStore.init();
    if (!userStore.openid) {
      wx.navigateTo({ url: '/pages/login/index?from=merchant' });
      return;
    }
    const merchantEntryService = require('../../services/merchant-entry.service');
    await merchantEntryService.goMerchantEntry(userStore.openid);
  }
});
