const { userStore } = require('../../stores/user.store');
const merchantService = require('../../services/merchant.service');

Page({
  data: {
    cfg: {
      name: '',
      phone: '',
      businessHours: '',
      province: '',
      city: '',
    },
    canEdit: true,
    nextEditableAt: '',
    cooldownHint: '',
    loading: true,
    saving: false,
  },

  onShow() {
    userStore.init();
    if (userStore.role !== 'b') {
      wx.showToast({ title: '请先切换商家身份', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 600);
      return;
    }
    this._load();
  },

  async _load() {
    this.setData({ loading: true });
    try {
      const cfg = await merchantService.getConfig();
      this._applyCfg(cfg);
      this.setData({ loading: false });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: (e.message || '加载失败').slice(0, 20), icon: 'none' });
    }
  },

  _applyCfg(cfg) {
    const canEdit = cfg.canEdit !== false;
    const nextEditableAt = cfg.nextEditableAt || '';
    let cooldownHint = '';
    if (!canEdit && nextEditableAt) {
      cooldownHint = '每月仅可修改一次，下次可编辑：' + nextEditableAt;
    }
    this.setData({
      cfg: {
        name: cfg.name || '',
        phone: cfg.phone || '',
        businessHours: cfg.businessHours || '',
        province: cfg.province || '',
        city: cfg.city || '',
      },
      canEdit,
      nextEditableAt,
      cooldownHint,
    });
  },

  onInput(e) {
    if (!this.data.canEdit) return;
    const field = e.currentTarget.dataset.field;
    this.setData({ ['cfg.' + field]: e.detail.value });
  },

  async onSave() {
    if (!this.data.canEdit) {
      wx.showToast({ title: this.data.cooldownHint || '本月已修改过', icon: 'none' });
      return;
    }
    const phone = this.data.cfg.phone || '';
    if (phone && !/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '手机号格式有误', icon: 'none' });
      return;
    }
    if (!(this.data.cfg.name || '').trim()) {
      wx.showToast({ title: '请填写门店名称', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    try {
      const res = await merchantService.saveConfig(this.data.cfg);
      if (res && res.merchant) {
        this._applyCfg(res.merchant);
      }
      wx.showToast({ title: '已保存' });
    } catch (e) {
      wx.showToast({ title: (e.message || '保存失败').slice(0, 24), icon: 'none', duration: 2800 });
    } finally {
      this.setData({ saving: false });
    }
  },
});
