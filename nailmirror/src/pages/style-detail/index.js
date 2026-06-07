const styleService = require('../../services/style.service');
const favoriteService = require('../../services/favorite.service');
const merchantContactService = require('../../services/merchant-contact.service');
const { tryOnStore } = require('../../stores/try-on.store');
const { userStore } = require('../../stores/user.store');
const cloudUtil = require('../../utils/cloud');
const { buildDisplayTags } = require('../../config/tag-vocabulary');

function resolveDisplayTags(style) {
  if (!style) return [];
  if (style.displayTags && style.displayTags.length) return style.displayTags;
  return buildDisplayTags(style.color, style.design, style.shapeLabel, style.styleLabel);
}

function isMerchantStyle(style) {
  return !!(style && style.styleSource === 'merchant-upload');
}

function normalizePhone(phone) {
  return String(phone || '').replace(/[\s-]/g, '');
}

function dialPhone(phone, contact) {
  const number = normalizePhone(phone);
  if (!number) {
    wx.showModal({
      title: '联系商家',
      content: '商家暂未留联系电话',
      showCancel: false,
      confirmText: '知道了'
    });
    return;
  }
  wx.makePhoneCall({
    phoneNumber: number,
    fail: (err) => {
      const msg = String((err && err.errMsg) || '');
      if (msg.indexOf('cancel') > -1) return;
      const lines = [
        contact && contact.storeName ? '门店：' + contact.storeName : '',
        '电话：' + number
      ].filter(Boolean);
      wx.showModal({
        title: '联系商家',
        content: lines.join('\n'),
        showCancel: false,
        confirmText: '知道了'
      });
    }
  });
}

Page({
  data: {
    style: null,
    displayTags: [],
    faved: false,
    merchantContact: null
  },
  async onLoad(query) {
    const id = query.id;
    if (!id) return;
    try {
      const style = await styleService.get(id);
      this.setData({
        style,
        displayTags: resolveDisplayTags(style),
        faved: favoriteService.has(id)
      });
      tryOnStore.setStyle(id);
      this._logStyleDetailView(id);
      if (isMerchantStyle(style)) {
        await this.loadMerchantContact(id);
      }
    } catch (e) {
      wx.showToast({ title: '款式不存在', icon: 'none' });
    }
  },
  async loadMerchantContact(styleId) {
    const res = await merchantContactService.getContactByStyleId(styleId);
    if (res && res.ok && res.contact) {
      this.setData({ merchantContact: res.contact });
    }
  },
  async onFav() {
    const id = this.data.style.id;
    if (this.data.faved) await favoriteService.remove(id);
    else await favoriteService.add(id);
    this.setData({ faved: !this.data.faved });
  },
  onGoStatic() {
    const id = this.data.style.id;
    wx.navigateTo({ url: '/pages/try-on-static/index?styleId=' + id });
  },
  async resolveMerchantContact(style) {
    if (!style || !isMerchantStyle(style)) return null;
    if (this.data.merchantContact) return this.data.merchantContact;
    const res = await merchantContactService.getContactByStyleId(style.id);
    if (!res || !res.ok || !res.contact) return null;
    this.setData({ merchantContact: res.contact });
    return res.contact;
  },

  async onContact() {
    const style = this.data.style;
    if (!isMerchantStyle(style)) {
      wx.showModal({
        title: '联系商家',
        content: '该款式不来源于任何入驻商家',
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }

    const contact = await this.resolveMerchantContact(style);
    if (!contact) {
      wx.showModal({
        title: '联系商家',
        content: '商家信息暂未配置',
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }

    dialPhone(contact.phone, contact);
  },

  async onDialPhone() {
    const style = this.data.style;
    const contact = await this.resolveMerchantContact(style);
    if (!contact) {
      wx.showToast({ title: '暂无联系电话', icon: 'none' });
      return;
    }
    dialPhone(contact.phone, contact);
  },

  _logStyleDetailView(styleId) {
    if (!styleId || !cloudUtil.isCloudReady()) return;
    const openid = (userStore && userStore.openid) || 'guest';
    cloudUtil.callFunction('ops', {
      action: 'logEvent',
      eventType: 'style_detail_view',
      styleId,
      userId: openid,
      sessionId: '',
      extra: { source: 'style_detail' },
    }).catch(() => {});
  },
});
