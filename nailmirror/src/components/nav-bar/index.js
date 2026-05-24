Component({
  properties: {
    title: { type: String, value: '' },
    showBack: { type: Boolean, value: true }
  },
  methods: {
    onBack() {
      wx.navigateBack({ delta: 1, fail: () => { wx.switchTab({ url: '/pages/home/index' }); } });
    }
  }
});
