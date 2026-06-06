const styleService = require('../../services/style.service');
const favoriteService = require('../../services/favorite.service');
const merchantContactService = require('../../services/merchant-contact.service');
const { tryOnStore } = require('../../stores/try-on.store');
const { buildDisplayTags } = require('../../config/tag-vocabulary');

function resolveDisplayTags(style) {
  if (!style) return [];
  if (style.displayTags && style.displayTags.length) return style.displayTags;
  return buildDisplayTags(style.color, style.design, style.shapeLabel, style.styleLabel);
}

function isMerchantStyle(style) {
  return !!(style && style.styleSource === 'merchant-upload');
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

    let contact = this.data.merchantContact;
    if (!contact) {
      const res = await merchantContactService.getContactByStyleId(style.id);
      if (!res || !res.ok || !res.contact) {
        wx.showModal({
          title: '联系商家',
          content: (res && res.message) || '商家信息暂未配置',
          showCancel: false,
          confirmText: '知道了'
        });
        return;
      }
      contact = res.contact;
      this.setData({ merchantContact: contact });
    }

    const region = [contact.province, contact.city].filter(Boolean).join(' ');
    const lines = [
      contact.storeName ? '门店：' + contact.storeName : '',
      region ? '地区：' + region : '',
      contact.phone ? '电话：' + contact.phone : ''
    ].filter(Boolean);
    wx.showModal({
      title: '联系商家',
      content: lines.join('\n'),
      cancelText: '关闭',
      confirmText: contact.phone ? '拨打电话' : '知道了',
      success: (res) => {
        if (res.confirm && contact.phone) {
          wx.makePhoneCall({ phoneNumber: contact.phone });
        }
      }
    });
  }
});
