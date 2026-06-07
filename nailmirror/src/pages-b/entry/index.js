const { userStore } = require('../../stores/user.store');
const merchantAuthService = require('../../services/merchant-auth.service');
const cloudUtil = require('../../utils/cloud');

Page({
  data: {
    role: 'c',
    checking: true,
    needPhoneVerify: false,
    phoneMasked: '',
    phoneInput: '',
    verifying: false,
  },

  async onShow() {
    userStore.init();
    this.setData({ checking: true, needPhoneVerify: false, phoneInput: '' });

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

      if (!cloudUtil.isCloudReady()) {
        wx.setNavigationBarTitle({ title: '商家身份核验' });
        this.setData({ needPhoneVerify: true, checking: false });
        return;
      }

      const gate = await cloudUtil.callFunction('ops', {
        action: 'getMerchantPhoneGate',
        openid: userStore.openid,
      });

      if (gate && gate.ok && gate.merchantVerified && gate.phoneVerified) {
        wx.setNavigationBarTitle({ title: '商家中心' });
        userStore.setRole('b');
        this.setData({ role: 'b', checking: false, needPhoneVerify: false });
        return;
      }

      wx.setNavigationBarTitle({ title: '商家身份核验' });
      this.setData({
        needPhoneVerify: true,
        phoneMasked: (gate && gate.phoneMasked) || '',
        checking: false,
      });
    } catch (e) {
      wx.showToast({ title: '商家身份校验失败，请稍后重试', icon: 'none' });
      this.setData({ role: userStore.role || 'c', checking: false });
    }
  },

  onPhoneInput(e) {
    const val = (e && e.detail && e.detail.value) || '';
    this.setData({ phoneInput: val.replace(/\D/g, '').slice(0, 11) });
  },

  async onSubmitPhoneVerify() {
    if (this.data.verifying) return;
    const phone = (this.data.phoneInput || '').trim();
    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '请输入正确的 11 位手机号', icon: 'none' });
      return;
    }

    this.setData({ verifying: true });
    try {
      const res = await cloudUtil.callFunction('ops', {
        action: 'verifyMerchantPhone',
        openid: userStore.openid,
        phone,
      });
      if (res && res.ok) {
        wx.setNavigationBarTitle({ title: '商家中心' });
        userStore.setRole('b');
        wx.showToast({ title: '验证成功', icon: 'success' });
        this.setData({
          role: 'b',
          needPhoneVerify: false,
          phoneInput: '',
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
