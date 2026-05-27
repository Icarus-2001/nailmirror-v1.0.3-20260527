const tryOnService = require('../../services/try-on.service');
const styleService = require('../../services/style.service');
const historyService = require('../../services/history.service');
const { getDeviceLevel } = require('../../utils/device');
const { tryOnStore } = require('../../stores/try-on.store');
const eventBus = require('../../utils/event-bus');
const { EVT_AR_FALLBACK_TRIGGERED } = require('../../config/constants');

Page({
  data: {
    deviceLevel: 'mid',
    showDowngrade: false,
    sessionId: '',
    fallback: false,
    firstFrameUrl: '',
    starting: true,
    style: null,
    drawerOpen: false,
    altStyles: [],
    styleId: ''
  },
  async onLoad(query) {
    // 第一步：设备分级
    const level = getDeviceLevel();
    this.setData({ deviceLevel: level });

    const styleId = query.styleId || tryOnStore.currentStyleId || 'french-01';
    this.setData({ styleId });

    if (level === 'low') {
      this.setData({ showDowngrade: true });
      eventBus.emit(EVT_AR_FALLBACK_TRIGGERED, { reason: 'device-low' });
      return;
    }

    await this._startAR(styleId);
    this._loadAlts();
  },
  async _startAR(styleId) {
    this.setData({ starting: true });
    try {
      const r = await tryOnService.startAR({ styleId, shape: tryOnStore.currentShape });
      const style = await styleService.get(styleId);
      this.setData({
        sessionId: r.sessionId,
        fallback: r.fallback,
        firstFrameUrl: r.firstFrameUrl,
        style,
        starting: false
      });
      if (r.fallback) {
        eventBus.emit(EVT_AR_FALLBACK_TRIGGERED, { reason: r.reason || 'service-fallback' });
        this.setData({ showDowngrade: true });
      }
    } catch (e) {
      this.setData({ starting: false });
      wx.showToast({ title: 'AR 启动失败', icon: 'none' });
    }
  },
  async _loadAlts() {
    const r = await styleService.list({ page: 1, pageSize: 8 });
    this.setData({ altStyles: r.items });
  },
  onOpenDrawer() { this.setData({ drawerOpen: true }); },
  onCloseDrawer() { this.setData({ drawerOpen: false }); },
  async onPickStyle(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ drawerOpen: false, styleId: id });
    tryOnStore.setStyle(id);
    await this._startAR(id);
  },
  async onShoot() {
    if (!this.data.style) return;
    wx.showLoading({ title: '出片中…' });
    try {
      const hd = await tryOnService.generateHD({ sessionId: this.data.sessionId, styleId: this.data.styleId });
      await historyService.append({
        userOpenid: 'me',
        styleId: this.data.styleId,
        nailShape: tryOnStore.currentShape,
        mode: 'ar',
        thumbUrl: this.data.firstFrameUrl,
        hdUrl: hd.hdUrl
      });
      wx.hideLoading();
      require('../../utils/hd-output-nav').navigateTo(this.data.styleId, hd.hdUrl);
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '出片失败', icon: 'none' });
    }
  },
  onGoStatic() { wx.redirectTo({ url: '/pages/try-on-static/index?styleId=' + this.data.styleId }); },
  onStayAR() { this.setData({ showDowngrade: false }); this._startAR(this.data.styleId); }
});
