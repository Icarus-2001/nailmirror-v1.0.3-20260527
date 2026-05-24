// HDImageExport 组件：封装高清出片保存动作
const imageUtil = require('../../utils/image');

Component({
  properties: {
    url: { type: String, value: '' },
    caption: { type: String, value: '' }
  },
  methods: {
    async onSave() {
      if (!this.data.url) return;
      wx.showLoading({ title: '保存中…' });
      try {
        // 下载再保存
        wx.downloadFile({
          url: this.data.url,
          success: async (res) => {
            try {
              await imageUtil.saveToAlbum(res.tempFilePath);
              wx.hideLoading();
              wx.showToast({ title: '已保存相册' });
              this.triggerEvent('saved', { url: this.data.url });
            } catch (e) {
              wx.hideLoading();
            }
          },
          fail: () => { wx.hideLoading(); wx.showToast({ title: '保存失败', icon: 'none' }); }
        });
      } catch (e) {
        wx.hideLoading();
      }
    },
    onCopyCaption() {
      wx.setClipboardData({ data: this.data.caption });
    }
  }
});
