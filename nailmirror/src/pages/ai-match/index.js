const aiMatchService = require('../../services/ai-match.service');
const favoriteService = require('../../services/favorite.service');
const { favoriteStore } = require('../../stores/favorite.store');

Page({
  data: {
    imagePath: '',
    matching: false,
    top5: [],
    fallback: false,
    favIds: []
  },
  onShow() {
    this.setData({ favIds: favoriteStore.ids.slice() });
  },
  onChoose() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      success: (res) => {
        const f = res.tempFiles[0];
        if (f.size > 10 * 1024 * 1024) {
          wx.showToast({ title: '图片大于 10MB', icon: 'none' });
          return;
        }
        this.setData({ imagePath: f.tempFilePath });
        this._match(f.tempFilePath);
      }
    });
  },
  async _match(p) {
    this.setData({ matching: true, top5: [], fallback: false });
    try {
      const r = await aiMatchService.matchBySnapshot(p);
      this.setData({ top5: r.top5, fallback: !!r.fallback, matching: false });
    } catch (e) {
      wx.showToast({ title: '识别失败', icon: 'none' });
      this.setData({ matching: false });
    }
  },
  onPick(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/try-on-ar/index?styleId=' + id });
  },
  async onFav(e) {
    const id = e.currentTarget.dataset.id;
    const has = favoriteStore.has(id);
    if (has) await favoriteService.remove(id);
    else await favoriteService.add(id);
    this.setData({ favIds: favoriteStore.ids.slice() });
  }
});
