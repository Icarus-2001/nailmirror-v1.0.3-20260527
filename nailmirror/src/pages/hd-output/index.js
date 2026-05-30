const tryOnService = require('../../services/try-on.service');
const adService = require('../../services/ad.service');
const imageUtil = require('../../utils/image');
const hdOutputNav = require('../../utils/hd-output-nav');
const quotaService = require('../../services/quota.service');
const { userStore } = require('../../stores/user.store');

Page({
  data: {
    styleId: '',
    hdUrl: '',
    caption: '',
    watermark: true,
    saving: false,
    quotaLeft: 2,
    showQuota: false
  },
  async onLoad(query) {
    const showQuota = quotaService.isFreeHDQuotaEnabled();
    const hdUrl = hdOutputNav.resolveHdUrl(query);
    this.setData({
      styleId: query.styleId || '',
      hdUrl,
      showQuota,
      quotaLeft: showQuota ? quotaService.getQuotaLeft() : 0
    });
    if (!this.data.hdUrl) {
      // 直接进入：再生成一次
      try {
        quotaService.assertFreeHD();
        const hd = await tryOnService.generateHD({ styleId: this.data.styleId || 'french-01' });
        quotaService.consumeFreeHDOnSuccess();
        this.setData({ hdUrl: hd.hdUrl, caption: hd.caption, watermark: hd.watermark });
        if (this.data.showQuota) {
          this.setData({ quotaLeft: quotaService.getQuotaLeft() });
        }
      } catch (e) {
        wx.showToast({ title: (e && e.message) || '出片失败', icon: 'none' });
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
    if (!this.data.hdUrl || this.data.saving) {
      if (!this.data.hdUrl) wx.showToast({ title: '图片未就绪', icon: 'none' });
      return;
    }
    const privacyUtil = require('../../utils/privacy');
    this.setData({ saving: true });
    try {
      await imageUtil.saveRemoteImageToAlbum(this.data.hdUrl);
      wx.showToast({ title: '已保存相册' });
    } catch (e) {
      if (privacyUtil.isPrivacyDeclinedError(e)) {
        wx.showToast({ title: e.message || '需同意隐私协议', icon: 'none' });
      } else {
        imageUtil.showSaveError(e, this.data.hdUrl);
      }
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
    if (!quotaService.isFreeHDQuotaEnabled()) return;
    userStore.grantFreeHD(1);
    this.setData({ quotaLeft: quotaService.getQuotaLeft() });
    wx.showToast({ title: '已 +1 出图额度' });
  }
});
