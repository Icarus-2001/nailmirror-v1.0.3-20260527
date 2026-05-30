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
      const privacyUtil = require('../../utils/privacy');
      try {
        await imageUtil.saveRemoteImageToAlbum(this.data.url);
        wx.showToast({ title: '已保存相册' });
        this.triggerEvent('saved', { url: this.data.url });
      } catch (e) {
        if (privacyUtil.isPrivacyDeclinedError(e)) {
          wx.showToast({ title: e.message || '需同意隐私协议', icon: 'none' });
        } else {
          imageUtil.showSaveError(e, this.data.url);
        }
      }
    },
    onCopyCaption() {
      wx.setClipboardData({ data: this.data.caption });
    }
  }
});
