const userService = require('../../services/user.service');
const { userStore } = require('../../stores/user.store');

Page({
  data: {
    loading: false
  },
  onLoad() {
    userStore.init();
    // 已登录直接跳首页
    if (userStore.openid) {
      setTimeout(() => wx.switchTab({ url: '/pages/home/index' }), 400);
    }
  },
  async onLogin() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      await userService.login();
      wx.showToast({ title: '登录成功' });
      setTimeout(() => wx.switchTab({ url: '/pages/home/index' }), 400);
    } catch (e) {
      wx.showToast({ title: '登录失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
  onSkip() {
    wx.switchTab({ url: '/pages/home/index' });
  }
});
