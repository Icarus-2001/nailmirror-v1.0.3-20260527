const styleService = require('../../services/style.service');
const favoriteService = require('../../services/favorite.service');
const merchantService = require('../../services/merchant.service');
const { favoriteStore } = require('../../stores/favorite.store');
const { tryOnStore } = require('../../stores/try-on.store');
const { buildDisplayTags } = require('../../config/tag-vocabulary');

function resolveDisplayTags(style) {
  if (!style) return [];
  if (style.displayTags && style.displayTags.length) return style.displayTags;
  return buildDisplayTags(style.color, style.design, style.shapeLabel, style.styleLabel);
}

Page({
  data: {
    style: null,
    displayTags: [],
    faved: false,
    merchant: null
  },
  async onLoad(query) {
    const id = query.id;
    if (!id) return;
    try {
      const style = await styleService.get(id);
      this.setData({
        style,
        displayTags: resolveDisplayTags(style),
        faved: favoriteStore.has(id)
      });
      tryOnStore.setStyle(id);
      if (style.merchantId) {
        const m = await merchantService.getConfig(style.merchantId);
        this.setData({ merchant: m });
      }
    } catch (e) {
      wx.showToast({ title: '款式不存在', icon: 'none' });
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
  onContact() {
    const m = this.data.merchant;
    if (!m) { wx.showToast({ title: '商家暂未配置', icon: 'none' }); return; }
    wx.showActionSheet({
      itemList: ['电话咨询', '加企微'],
      success: (res) => {
        if (res.tapIndex === 0 && m.phone) wx.makePhoneCall({ phoneNumber: m.phone });
        else if (res.tapIndex === 1) wx.previewImage({ urls: [m.wecomQrUrl] });
      }
    });
  }
});
