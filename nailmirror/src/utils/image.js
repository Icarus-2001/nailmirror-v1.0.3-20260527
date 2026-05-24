// 图片工具：压缩 / 保存相册 / 选图
const logger = require('./logger');

function compress(srcPath, quality = 80) {
  return new Promise((resolve, reject) => {
    if (!wx.compressImage) return resolve(srcPath);
    wx.compressImage({
      src: srcPath,
      quality,
      success: (res) => resolve(res.tempFilePath),
      fail: (err) => reject(err)
    });
  });
}

function saveToAlbum(filePath) {
  return new Promise((resolve, reject) => {
    wx.saveImageToPhotosAlbum({
      filePath,
      success: () => resolve(true),
      fail: (err) => {
        if (err && err.errMsg && err.errMsg.indexOf('auth') > -1) {
          wx.showModal({
            title: '需要保存权限',
            content: '请在设置中允许保存到相册',
            confirmText: '去设置',
            success: (r) => { if (r.confirm) wx.openSetting(); }
          });
        }
        reject(err);
      }
    });
  });
}

function _errMsg(err, fallback) {
  if (!err) return fallback;
  return err.errMsg || err.message || fallback;
}

function _isCancel(err) {
  const msg = _errMsg(err, '');
  return msg.indexOf('cancel') > -1 || msg.indexOf('取消') > -1;
}

function _chooseImage(sourceType) {
  return new Promise((resolve, reject) => {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed', 'original'],
      sourceType: sourceType || ['album'],
      success: (res) => {
        const p = res.tempFilePaths && res.tempFilePaths[0];
        if (!p) reject(new Error('未选择图片'));
        else resolve(p);
      },
      fail: (err) => reject(err || new Error('选择图片失败'))
    });
  });
}

function _chooseMedia(sourceType) {
  return new Promise((resolve, reject) => {
    if (!wx.chooseMedia) {
      reject(new Error('chooseMedia 不可用'));
      return;
    }
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: sourceType || ['album'],
      sizeType: ['compressed'],
      success: (res) => {
        const f = res.tempFiles && res.tempFiles[0];
        if (!f || !f.tempFilePath) {
          reject(new Error('未选择图片'));
          return;
        }
        if (f.size > 10 * 1024 * 1024) {
          reject(new Error('图片大于 10MB'));
          return;
        }
        resolve(f.tempFilePath);
      },
      fail: (err) => reject(err || new Error('选择图片失败'))
    });
  });
}

/** @param {'album'|'camera'} mode */
function pickHandPhoto(mode) {
  const sourceType = mode === 'camera' ? ['camera'] : ['album'];
  let firstErr = null;
  return _chooseImage(sourceType)
    .catch((err1) => {
      firstErr = err1;
      logger.warn('[image] chooseImage fail', err1);
      return _chooseMedia(sourceType);
    })
    .catch((err2) => {
      logger.warn('[image] chooseMedia fail', err2);
      const err = err2 || firstErr;
      if (_isCancel(err)) throw err;
      const msg = _errMsg(err, '选择图片失败');
      if (msg.indexOf('privacy') > -1 || msg.indexOf('authorize') > -1 || msg.indexOf('auth') > -1) {
        throw new Error('需同意隐私协议后才能使用相册/相机');
      }
      throw new Error(msg);
    });
}

function resolveBundledPhoto(bundlePath) {
  return new Promise((resolve, reject) => {
    const fs = wx.getFileSystemManager();
    const ext = (bundlePath.match(/\.(\w+)$/) || [])[1] || 'jpg';
    const dest = `${wx.env.USER_DATA_PATH}/bundled-${Date.now()}.${ext}`;
    fs.copyFile({
      srcPath: bundlePath,
      destPath: dest,
      success: () => resolve(dest),
      fail: (err) => reject(err || new Error('复制内置图片失败'))
    });
  });
}

function downloadRemoteHand(url) {
  return new Promise((resolve, reject) => {
    wx.downloadFile({
      url,
      success: (res) => {
        if (res.statusCode === 200 && res.tempFilePath) resolve(res.tempFilePath);
        else reject(new Error('下载手照失败 HTTP ' + (res.statusCode || '?')));
      },
      fail: (err) => reject(err || new Error('下载手照失败'))
    });
  });
}

module.exports = { compress, saveToAlbum, pickHandPhoto, resolveBundledPhoto, downloadRemoteHand };
