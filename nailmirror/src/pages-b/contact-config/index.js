const merchantService = require('../../services/merchant.service');
const { ensurePrivacyAuthorized } = require('../../utils/privacy');

Page({
  data: {
    cfg: { name: '', phone: '', wecomQrUrl: '', businessHours: '' },
    saving: false
  },
  onReady() {
    this._preparePrivacy();
  },
  async onLoad() {
    const cfg = await merchantService.getConfig();
    if (cfg) this.setData({ cfg });
  },
  async _preparePrivacy() {
    try {
      await ensurePrivacyAuthorized();
      this._privacyReady = true;
    } catch (e) {
      this._privacyReady = false;
    }
  },
  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ ['cfg.' + field]: e.detail.value });
  },
  async onUploadQr() {
    if (!this._privacyReady) await this._preparePrivacy();
    if (!this._privacyReady) {
      wx.showToast({ title: '需同意隐私协议后才能选图', icon: 'none' });
      return;
    }
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: (res) => {
        this.setData({ 'cfg.wecomQrUrl': res.tempFiles[0].tempFilePath });
      }
    });
  },
  async onSave() {
    const phone = this.data.cfg.phone || '';
    if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '手机号格式有误', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    try {
      await merchantService.saveConfig(this.data.cfg);
      wx.showToast({ title: '已保存' });
    } catch (e) {
      wx.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  }
});
