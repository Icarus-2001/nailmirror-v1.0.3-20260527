const adService = require('../../services/ad.service');

Component({
  properties: {
    label: { type: String, value: '观看广告去水印' }
  },
  methods: {
    async onTap() {
      wx.showLoading({ title: '加载广告…' });
      const res = await adService.showRewardedAd();
      wx.hideLoading();
      this.triggerEvent('result', res);
      if (res && res.completed) {
        wx.showToast({ title: '奖励已发放' });
      } else {
        wx.showToast({ title: '未完整观看', icon: 'none' });
      }
    }
  }
});
