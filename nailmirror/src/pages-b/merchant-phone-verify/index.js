const { userStore } = require('../../stores/user.store');
const cloudUtil = require('../../utils/cloud');
const merchantEntryService = require('../../services/merchant-entry.service');
const { ensurePrivacyAuthorized } = require('../../utils/privacy');

Page({
  data: {
    phoneMasked: '',
    verifying: false,
  },

  onReady() {
    ensurePrivacyAuthorized().catch(() => {});
  },

  async onShow() {
    userStore.init();
    if (!userStore.openid) {
      wx.redirectTo({ url: '/pages/login/index?from=merchant' });
      return;
    }

    const route = await merchantEntryService.resolveMerchantEntryRoute(userStore.openid);
    if (route === 'verify') {
      wx.redirectTo({ url: '/pages-b/merchant-verify/index' });
      return;
    }
    if (route === 'entry') {
      wx.redirectTo({ url: '/pages-b/entry/index' });
      return;
    }

    try {
      const gate = await cloudUtil.callFunction('ops', {
        action: 'getMerchantPhoneGate',
        openid: userStore.openid,
      });
      this.setData({ phoneMasked: (gate && gate.phoneMasked) || '' });
    } catch (e) {
      wx.showToast({ title: '加载失败，请稍后重试', icon: 'none' });
    }
  },

  async onGetPhoneNumber(e) {
    if (this.data.verifying) return;
    const detail = e && e.detail;
    const errMsg = detail && detail.errMsg;
    if (errMsg && errMsg.indexOf('getPhoneNumber:ok') < 0) {
      if (errMsg.indexOf('cancel') < 0) {
        wx.showToast({ title: '需要授权手机号才能进入商家中心', icon: 'none' });
      }
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
        userStore.setRole('b');
        wx.showToast({ title: '验证成功', icon: 'success' });
        setTimeout(() => wx.redirectTo({ url: '/pages-b/entry/index' }), 600);
        return;
      }
      wx.showToast({ title: (res && res.error) || '验证失败', icon: 'none' });
    } catch (err) {
      wx.showToast({ title: '网络异常，请稍后重试', icon: 'none' });
    } finally {
      this.setData({ verifying: false });
    }
  },

  onBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
      return;
    }
    wx.switchTab({ url: '/pages/me/index' });
  },
});
