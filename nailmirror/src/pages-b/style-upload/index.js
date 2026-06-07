const { userStore } = require('../../stores/user.store');
const merchantStyleService = require('../../services/merchant-style.service');
const { ensurePrivacyAuthorized } = require('../../utils/privacy');

const MAX_COUNT = 9;
const MAX_SIZE = 10 * 1024 * 1024;

function fileName(path) {
  return String(path || '').split(/[\\/]/).filter(Boolean).pop() || '款式图片';
}

function normalizeFiles(tempFiles) {
  return (tempFiles || []).map((file, index) => {
    const localPath = file.tempFilePath || file.path || '';
    return {
      id: String(Date.now()) + '-' + index,
      localPath,
      name: fileName(localPath),
      size: file.size || 0,
      status: 'ready',
      statusText: '待上传',
      error: '',
      style: null
    };
  }).filter((file) => file.localPath);
}

Page({
  data: {
    role: 'c',
    files: [],
    uploading: false,
    successCount: 0,
    failedCount: 0,
    cachedCount: 0
  },

  onReady() {
    this._preparePrivacy();
  },

  onShow() {
    userStore.init();
    const cached = merchantStyleService.getCachedMerchantStylesForMerchant(userStore.openid);
    this.setData({
      role: userStore.role || 'c',
      cachedCount: cached.length
    });
  },

  async _preparePrivacy() {
    try {
      await ensurePrivacyAuthorized();
      this._privacyReady = true;
    } catch (e) {
      this._privacyReady = false;
    }
  },

  async onChooseImages() {
    if (this.data.uploading) return;
    if (!this._privacyReady) await this._preparePrivacy();
    if (!this._privacyReady) {
      wx.showToast({ title: '需同意隐私协议后才能选图', icon: 'none' });
      return;
    }
    wx.chooseMedia({
      count: MAX_COUNT,
      mediaType: ['image'],
      sourceType: ['album'],
      sizeType: ['compressed'],
      success: (res) => {
        const files = normalizeFiles(res.tempFiles)
          .map((file) => {
            if (file.size && file.size > MAX_SIZE) {
              return Object.assign({}, file, {
                status: 'failed',
                statusText: '图片过大',
                error: '单张图片需小于 10MB'
              });
            }
            return file;
          });
        this.setData({ files, successCount: 0, failedCount: files.filter((f) => f.status === 'failed').length });
      },
      fail: (err) => {
        const msg = err && (err.errMsg || err.message) ? (err.errMsg || err.message) : '选择图片失败';
        if (msg.indexOf('cancel') < 0) wx.showToast({ title: msg.slice(0, 20), icon: 'none' });
      }
    });
  },

  async onUpload() {
    if (this.data.uploading) return;
    if (this.data.role !== 'b') {
      wx.showToast({ title: '请先切换商家身份', icon: 'none' });
      return;
    }
    const readyFiles = this.data.files.filter((file) => file.status === 'ready');
    if (!readyFiles.length) {
      wx.showToast({ title: '请先选择图片', icon: 'none' });
      return;
    }

    this.setData({
      uploading: true,
      files: this.data.files.map((file) => file.status === 'ready'
        ? Object.assign({}, file, { status: 'uploading', statusText: '上传与打标中', error: '' })
        : file)
    });

    try {
      const result = await merchantStyleService.uploadMerchantStyles(readyFiles.map((file) => file.localPath));
      const byPath = {};
      (result.results || []).forEach((item) => {
        if (item.localPath) byPath[item.localPath] = item;
      });
      const files = this.data.files.map((file) => {
        const item = byPath[file.localPath];
        if (!item) return file;
        if (item.status === 'success') {
          return Object.assign({}, file, {
            status: 'success',
            statusText: '已入库',
            style: item.style,
            error: ''
          });
        }
        return Object.assign({}, file, {
          status: 'failed',
          statusText: '上传失败',
          error: item.error || '上传失败'
        });
      });
      const successCount = files.filter((file) => file.status === 'success').length;
      const failedCount = files.filter((file) => file.status === 'failed').length;
      this.setData({
        files,
        successCount,
        failedCount,
        cachedCount: merchantStyleService.getCachedMerchantStylesForMerchant(userStore.openid).length
      });
      wx.showToast({ title: successCount ? '款式已入库' : '上传未成功', icon: successCount ? 'success' : 'none' });
    } catch (e) {
      const msg = e && e.message ? e.message : '上传失败';
      this.setData({
        files: this.data.files.map((file) => file.status === 'uploading'
          ? Object.assign({}, file, { status: 'failed', statusText: '上传失败', error: msg })
          : file),
        failedCount: this.data.files.length
      });
      wx.showToast({ title: msg.slice(0, 20), icon: 'none' });
    } finally {
      this.setData({ uploading: false });
    }
  },

  onClear() {
    if (this.data.uploading) return;
    this.setData({ files: [], successCount: 0, failedCount: 0 });
  },

  onGoLibrary() {
    wx.navigateTo({ url: '/pages/style-library/index' });
  },

  onGoEntry() {
    wx.navigateBack();
  }
});
