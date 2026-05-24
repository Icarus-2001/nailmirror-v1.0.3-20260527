const tryOnService = require('../../services/try-on.service');
const adService = require('../../services/ad.service');
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
    this.setData({
      styleId: query.styleId || '',
      hdUrl: decodeURIComponent(query.hdUrl || ''),
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
    if (!this.data.hdUrl) return;
    this.setData({ saving: true });
    wx.downloadFile({
      url: this.data.hdUrl,
      success: (res) => {
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => wx.showToast({ title: '已保存相册' }),
          fail: () => wx.showToast({ title: '保存失败', icon: 'none' })
        });
      },
      fail: () => wx.showToast({ title: '下载失败', icon: 'none' }),
      complete: () => this.setData({ saving: false })
    });
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
