const tryOnService = require('../../services/try-on.service');
const adService = require('../../services/ad.service');
const imageUtil = require('../../utils/image');
const hdOutputNav = require('../../utils/hd-output-nav');
const { userStore } = require('../../stores/user.store');

Page({
  data: {
    styleId: '',
    hdUrl: '',
    caption: '',
    watermark: true,
    saving: false,
    quotaLeft: 2
  },
  async onLoad(query) {
    userStore.init();
    const hdUrl = hdOutputNav.resolveHdUrl(query);
    this.setData({
      styleId: query.styleId || '',
      hdUrl,
      quotaLeft: userStore.dailyFreeHDLeft
    });
    if (!this.data.hdUrl) {
      // 直接进入：再生成一次
      try {
        const hd = await tryOnService.generateHD({ styleId: this.data.styleId || 'french-01' });
        this.setData({ hdUrl: hd.hdUrl, caption: hd.caption, watermark: hd.watermark });
        userStore.consumeFreeHD();
        this.setData({ quotaLeft: userStore.dailyFreeHDLeft });
      } catch (e) {
        wx.showToast({ title: '出片失败', icon: 'none' });
      }
    } else {
      // 从 AR/Static 跳来
      this.setData({
        caption: '今日美甲上新 ✨ 风格适配、肤色友好，姐妹冲！#NailMirror',
        watermark: true
      });
    }
  },
  async onSave() {
    if (!this.data.hdUrl) {
      wx.showToast({ title: '图片未就绪', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    wx.showLoading({ title: '保存中…', mask: true });
    try {
      await imageUtil.saveRemoteImageToAlbum(this.data.hdUrl);
      wx.hideLoading();
      wx.showToast({ title: '已保存相册' });
    } catch (e) {
      wx.hideLoading();
      imageUtil.showSaveError(e, this.data.hdUrl);
    } finally {
      this.setData({ saving: false });
    }
  },
  async onRemoveWatermark() {
    const r = await adService.showRewardedAd();
    if (r && r.completed) {
      this.setData({ watermark: false });
      wx.showToast({ title: '已去除水印' });
    } else {
      wx.showToast({ title: '需完整观看广告', icon: 'none' });
    }
  },
  onShareTimeline() {
    return { title: this.data.caption };
  },
  onShareAppMessage() {
    return { title: this.data.caption, path: '/pages/home/index', imageUrl: this.data.hdUrl };
  },
  onCopyCaption() {
    wx.setClipboardData({ data: this.data.caption });
  },
  async onShareAndGrant() {
    // 模拟分享回调 +1
    userStore.grantFreeHD(1);
    this.setData({ quotaLeft: userStore.dailyFreeHDLeft });
    wx.showToast({ title: '已 +1 出图额度' });
  }
});
