const { userStore } = require('../../stores/user.store');
const merchantAuthService = require('../../services/merchant-auth.service');
const cloudUtil = require('../../utils/cloud');
const { ensurePrivacyAuthorized, isPrivacyDeclinedError } = require('../../utils/privacy');

Page({
  data: {
    role: 'c',
    checking: true,
    needPhoneVerify: false,
    phoneMasked: '',
    verifying: false,
  },

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

  async onShow() {
    userStore.init();
    this.setData({ checking: true, needPhoneVerify: false });

    if (!userStore.openid) {
      wx.redirectTo({ url: '/pages/login/index?from=merchant' });
      return;
    }

    try {
      const verified = await merchantAuthService.isMerchantVerified(userStore.openid);
      if (!verified) {
        userStore.setRole('c');
        wx.redirectTo({ url: '/pages-b/merchant-verify/index' });
        return;
      }

      if (cloudUtil.isCloudReady()) {
        const gate = await cloudUtil.callFunction('ops', {
          action: 'getMerchantPhoneGate',
          openid: userStore.openid,
        });
        if (gate && gate.ok && gate.merchantVerified && !gate.phoneVerified) {
          if (!this._privacyReady) await this._preparePrivacy();
          wx.setNavigationBarTitle({ title: '商家身份核验' });
          this.setData({
            needPhoneVerify: true,
            phoneMasked: gate.phoneMasked || '',
            checking: false,
          });
          return;
        }
      }

      wx.setNavigationBarTitle({ title: '商家中心' });
      userStore.setRole('b');
      this.setData({ role: 'b', checking: false, needPhoneVerify: false });
    } catch (e) {
      wx.showToast({ title: '商家身份校验失败，请稍后重试', icon: 'none' });
      this.setData({ role: userStore.role || 'c', checking: false });
    }
  },

  async onGetPhoneNumber(e) {
    if (this.data.verifying) return;
    if (!this._privacyReady) {
      try {
        await ensurePrivacyAuthorized();
        this._privacyReady = true;
      } catch (err) {
        wx.showToast({
          title: isPrivacyDeclinedError(err) ? '需同意隐私协议后才能验证手机号' : '请先完成隐私授权',
          icon: 'none',
        });
        return;
      }
    }
    const detail = e && e.detail;
    const errMsg = (detail && detail.errMsg) || '';
    if (errMsg.indexOf('getPhoneNumber:ok') < 0) {
      if (errMsg.indexOf('cancel') >= 0 || errMsg.indexOf('deny') >= 0) return;
      if (errMsg.indexOf('privacy') >= 0 || errMsg.indexOf('隐私') >= 0) {
        wx.showToast({ title: '请先同意隐私协议后再试', icon: 'none' });
        return;
      }
      if (errMsg.indexOf('fail') >= 0) {
        wx.showToast({
          title: '模拟器不支持手机号授权，请用真机预览',
          icon: 'none',
          duration: 3000,
        });
        return;
      }
      wx.showToast({ title: '需要授权手机号才能进入商家中心', icon: 'none' });
      return;
    }
    const code = detail && detail.code;
    if (!code) {
      wx.showToast({ title: '未获取到手机号凭证', icon: 'none' });
      return;
    }

    const okPrivacy = await ensurePrivacyAuthorized().catch(() => false);
    if (!okPrivacy) {
      wx.showToast({ title: '请先同意隐私协议', icon: 'none' });
      return;
    }

    this.setData({ verifying: true });
    try {
      const res = await cloudUtil.callFunction('ops', {
        action: 'verifyMerchantPhone',
        openid: userStore.openid,
        code,
      });
      if (res && res.ok) {
        wx.setNavigationBarTitle({ title: '商家中心' });
        userStore.setRole('b');
        wx.showToast({ title: '验证成功', icon: 'success' });
        this.setData({
          role: 'b',
          needPhoneVerify: false,
          verifying: false,
          checking: false,
        });
        return;
      }
      wx.showToast({ title: (res && res.error) || '验证失败', icon: 'none' });
    } catch (err) {
      wx.showToast({ title: '网络异常，请稍后重试', icon: 'none' });
    } finally {
      this.setData({ verifying: false });
    }
  },

  onPhoneVerifyBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
      return;
    }
    wx.switchTab({ url: '/pages/me/index' });
  },

  onSwitchToC() {
    userStore.setRole('c');
    wx.navigateBack();
  },

  onGoDashboard() { wx.navigateTo({ url: '/pages-b/dashboard/index' }); },
  onGoStyleUpload() { wx.navigateTo({ url: '/pages-b/style-upload/index' }); },
  onGoContact() { wx.navigateTo({ url: '/pages-b/contact-config/index' }); },
  onGoMembership() { wx.navigateTo({ url: '/pages-b/membership/index' }); },
});
