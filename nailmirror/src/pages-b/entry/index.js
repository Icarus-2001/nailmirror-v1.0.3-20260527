const { userStore } = require('../../stores/user.store');
const { getExitMerchantNavAction } = require('../../utils/merchant-exit');
const merchantAuthService = require('../../services/merchant-auth.service');
const merchantStyleService = require('../../services/merchant-style.service');
const cloudUtil = require('../../utils/cloud');
const { showOpsError } = require('../../utils/ops-error');

Page({
  data: {
    role: 'c',
    checking: true,
    needPhoneVerify: false,
    phoneVerifyPurpose: 'entry',
    phoneMasked: '',
    phoneInput: '',
    verifying: false,
  },

  async onShow() {
    userStore.init();
    this.setData({
      checking: true,
      needPhoneVerify: false,
      phoneInput: '',
      phoneVerifyPurpose: 'entry',
    });

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
        phoneVerifyPurpose: 'entry',
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

  onTapRevoke() {
    wx.showModal({
      title: '注销商家资质',
      content: '注销后商家身份将失效，您上传的款式将立即从款式库下架；若仍在热度榜单中，将于次日更新后移除。如需重新入驻须重走资质验证。确定继续？',
      confirmText: '继续注销',
      confirmColor: '#e11d48',
      success: (res) => {
        if (!res.confirm) return;
        this._startPhoneVerify('revoke');
      },
    });
  },

  async _startPhoneVerify(purpose) {
    let phoneMasked = this.data.phoneMasked;
    if (cloudUtil.isCloudReady()) {
      try {
        const gate = await cloudUtil.callFunction('ops', {
          action: 'getMerchantPhoneGate',
          openid: userStore.openid,
        });
        phoneMasked = (gate && gate.phoneMasked) || phoneMasked;
      } catch (e) {
        // 沿用已有脱敏号
      }
    }
    wx.setNavigationBarTitle({ title: purpose === 'revoke' ? '注销资质验证' : '商家身份核验' });
    this.setData({
      needPhoneVerify: true,
      phoneVerifyPurpose: purpose,
      phoneMasked,
      phoneInput: '',
      checking: false,
    });
  },

  async onSubmitPhoneVerify() {
    if (this.data.verifying) return;
    const phone = (this.data.phoneInput || '').trim();
    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '请输入正确的 11 位手机号', icon: 'none' });
      return;
    }

    if (this.data.phoneVerifyPurpose === 'revoke') {
      await this._submitRevoke(phone);
      return;
    }
    await this._submitEntryVerify(phone);
  },

  async _submitEntryVerify(phone) {
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
      showOpsError(res, '验证失败');
    } catch (err) {
      wx.showToast({ title: '网络异常，请稍后重试', icon: 'none' });
    } finally {
      this.setData({ verifying: false });
    }
  },

  async _submitRevoke(phone) {
    this.setData({ verifying: true });
    try {
      const res = await cloudUtil.callFunction('ops', {
        action: 'revokeMerchantQualification',
        openid: userStore.openid,
        phone,
      });
      if (res && res.ok) {
        userStore.setRole('c');
        merchantStyleService.invalidateMerchantStylesCache();
        wx.showModal({
          title: '注销成功',
          content: '您的商家资质已注销，账号已恢复为普通用户。重新入驻请从「商家经营入口」完成资质验证。',
          showCancel: false,
          confirmText: '知道了',
          success: () => wx.switchTab({ url: '/pages/me/index' }),
        });
        return;
      }
      showOpsError(res, '注销失败');
    } catch (err) {
      wx.showToast({ title: '网络异常，请稍后重试', icon: 'none' });
    } finally {
      this.setData({ verifying: false });
    }
  },

  onPhoneVerifyBack() {
    if (this.data.phoneVerifyPurpose === 'revoke') {
      wx.setNavigationBarTitle({ title: '商家中心' });
      this.setData({
        needPhoneVerify: false,
        phoneVerifyPurpose: 'entry',
        phoneInput: '',
        role: 'b',
      });
      return;
    }
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
      return;
    }
    wx.switchTab({ url: '/pages/me/index' });
  },

  onSwitchToC() {
    userStore.setRole('c');
    const action = getExitMerchantNavAction(getCurrentPages().length);
    if (action === 'navigateBack') {
      wx.navigateBack();
    } else {
      wx.switchTab({ url: '/pages/me/index' });
    }
    wx.showToast({ title: '已退出商家模式', icon: 'none' });
  },

  onGoDashboard() { wx.navigateTo({ url: '/pages-b/dashboard/index' }); },
  onGoStyleUpload() { wx.navigateTo({ url: '/pages-b/style-upload/index' }); },
  onGoContact() { wx.navigateTo({ url: '/pages-b/contact-config/index' }); },
  onGoMembership() { wx.navigateTo({ url: '/pages-b/membership/index' }); },
});
