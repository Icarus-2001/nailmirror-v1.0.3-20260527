const { favoriteStore } = require('../../stores/favorite.store');
const favoriteService = require('../../services/favorite.service');

Component({
  properties: {
    style: { type: Object, value: null },
    showFav: { type: Boolean, value: true }
  },
  data: {
    faved: false
  },
  observers: {
    'style': function (s) {
      if (s && s.id) this.setData({ faved: favoriteStore.has(s.id) });
    }
  },
  methods: {
    onTap() {
      const s = this.data.style;
      if (!s) return;
      this.triggerEvent('tap', { style: s });
      wx.navigateTo({ url: '/pages/style-detail/index?id=' + s.id });
    },
    async onFav(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      const s = this.data.style;
      if (!s) return;
      const isFav = favoriteStore.has(s.id);
      if (isFav) await favoriteService.remove(s.id);
      else await favoriteService.add(s.id);
      this.setData({ faved: !isFav });
      this.triggerEvent('favchange', { id: s.id, faved: !isFav });
    }
  }
});
