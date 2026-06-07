const { userStore } = require('../../stores/user.store');
const cloudUtil = require('../../utils/cloud');

Page({
  data: {
    form: {
      token: '',
      phone: '',
      storeName: '',
      province: '',
      city: '',
      reviewUrl: ''
    },
    regionText: '请选择省市',
    submitting: false
  },

  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ ['form.' + field]: e.detail.value });
  },

  onRegionChange(e) {
    const [province, city] = e.detail.value;
    this.setData({
      'form.province': province,
      'form.city': city,
      regionText: province + ' ' + city
    });
  },

  async onSubmit() {
    const { form } = this.data;
    if (!form.token) return wx.showToast({ title: '请输入内测口令', icon: 'none' });
    if (!form.phone) return wx.showToast({ title: '请输入手机号', icon: 'none' });
    if (!/^1\d{10}$/.test(form.phone)) return wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
    if (!form.storeName) return wx.showToast({ title: '请输入门店名称', icon: 'none' });
    if (!form.province || !form.city) return wx.showToast({ title: '请选择所在城市', icon: 'none' });

    this.setData({ submitting: true });
    try {
      const res = await cloudUtil.callFunction('ops', {
        action: 'verifyMerchant',
        token: form.token,
        phone: form.phone,
        storeName: form.storeName,
        province: form.province,
        city: form.city,
        reviewUrl: form.reviewUrl || '',
        openid: userStore.openid
      });
      if (res && res.ok) {
        userStore.setRole('b');
        wx.showToast({ title: '验证成功，欢迎入驻！', icon: 'success' });
        setTimeout(() => wx.redirectTo({ url: '/pages-b/merchant-phone-verify/index' }), 1200);
      } else {
        wx.showToast({ title: (res && res.error) || '口令错误，无法切换', icon: 'none' });
      }
    } catch (e) {
      wx.showToast({ title: '网络异常，请稍后重试', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  onGoApply() {
    wx.showToast({ title: '请联系平台申请入驻', icon: 'none' });
  }
});
