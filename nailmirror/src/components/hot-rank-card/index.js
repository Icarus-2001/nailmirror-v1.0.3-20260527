Component({
  properties: {
    rank: { type: Number, value: 1 },
    item: { type: Object, value: null }
  },
  methods: {
    onTap() {
      const it = this.data.item;
      if (it && it.styleId) wx.navigateTo({ url: '/pages/style-detail/index?id=' + it.styleId });
    }
  }
});
