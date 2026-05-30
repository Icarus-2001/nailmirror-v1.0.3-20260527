// 图片工具：压缩 / 保存相册 / 选图
const logger = require('./logger');
const cloudUtil = require('./cloud');
const privacyUtil = require('./privacy');

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

function _errMsg(err, fallback) {
  if (!err) return fallback;
  return err.errMsg || err.message || fallback;
}

function _isCancel(err) {
  const msg = _errMsg(err, '');
  return msg.indexOf('cancel') > -1 || msg.indexOf('取消') > -1;
}

function _isAuthError(err) {
  const msg = _errMsg(err, '').toLowerCase();
  return msg.indexOf('auth') > -1
    || msg.indexOf('authorize') > -1
    || msg.indexOf('permission') > -1
    || msg.indexOf('deny') > -1
    || msg.indexOf('权限') > -1
    || msg.indexOf('拒绝') > -1;
}

function _isDomainError(err) {
  const msg = _errMsg(err, '');
  return msg.indexOf('domain') > -1 || msg.indexOf('合法域名') > -1;
}

function _hostFromUrl(url) {
  const m = String(url || '').match(/^https?:\/\/([^/?#]+)/i);
  return m ? m[1] : '';
}

function _promptOpenAlbumSetting(reject) {
  wx.showModal({
    title: '需要相册权限',
    content: '请在设置中开启「保存到相册」权限后重试',
    confirmText: '去设置',
    success: (r) => {
      if (r.confirm && wx.openSetting) wx.openSetting();
      if (reject) reject(new Error('未开启相册权限'));
    }
  });
}

function ensureWritePhotosAlbum() {
  return new Promise((resolve, reject) => {
    wx.getSetting({
      success: (res) => {
        const granted = res.authSetting && res.authSetting['scope.writePhotosAlbum'];
        if (granted === true) {
          resolve(true);
          return;
        }
        if (granted === false) {
          _promptOpenAlbumSetting(reject);
          return;
        }
        resolve(true);
      },
      fail: () => resolve(true)
    });
  });
}

function saveToAlbum(filePath) {
  return new Promise((resolve, reject) => {
    wx.saveImageToPhotosAlbum({
      filePath,
      success: () => resolve(true),
      fail: (err) => {
        logger.warn('[image] saveToAlbum fail', err);
        if (_isAuthError(err)) _promptOpenAlbumSetting(reject);
        else reject(err || new Error('保存到相册失败'));
      }
    });
  });
}

function getImageInfoPath(src) {
  return new Promise((resolve, reject) => {
    wx.getImageInfo({
      src,
      success: (res) => {
        if (res.path) resolve(res.path);
        else reject(new Error('无法读取图片'));
      },
      fail: (err) => reject(err || new Error('无法读取图片'))
    });
  });
}

function downloadRemoteHand(url) {
  return new Promise((resolve, reject) => {
    wx.downloadFile({
      url,
      success: (res) => {
        if (res.tempFilePath) resolve(res.tempFilePath);
        else reject(new Error('下载图片失败 HTTP ' + (res.statusCode || '?')));
      },
      fail: (err) => {
        const msg = _errMsg(err, '下载图片失败');
        if (_isDomainError(err)) {
          reject(new Error('图片域名未加入 downloadFile 合法域名：' + _hostFromUrl(url)));
        } else {
          reject(err || new Error(msg));
        }
      }
    });
  });
}

async function resolveImageLocalPath(url) {
  if (!url) throw new Error('图片地址为空');
  if (url.indexOf('cloud://') === 0) {
    return cloudUtil.downloadCloudFile(url);
  }
  try {
    return await getImageInfoPath(url);
  } catch (e1) {
    logger.warn('[image] getImageInfo fail, fallback downloadFile', _errMsg(e1, ''));
    return downloadRemoteHand(url);
  }
}

function copyToUserDataPath(srcPath) {
  return new Promise((resolve, reject) => {
    const fs = wx.getFileSystemManager();
    const ext = (String(srcPath).match(/\.(\w+)$/) || [])[1] || 'jpg';
    const dest = `${wx.env.USER_DATA_PATH}/album-${Date.now()}.${ext}`;
    fs.copyFile({
      srcPath,
      destPath: dest,
      success: () => resolve(dest),
      fail: (err) => reject(err || new Error('复制图片失败'))
    });
  });
}

function showSaveError(err, url) {
  const raw = _errMsg(err, '保存失败');
  logger.error('[image] saveRemote fail', raw, url);
  let content = raw;
  if (_isDomainError(err)) {
    const host = _hostFromUrl(url);
    content = host
      ? '请在微信公众平台 → 服务器域名 → downloadFile 中添加：\nhttps://' + host
      : '请在微信公众平台配置 downloadFile 合法域名';
  } else if (_isAuthError(err)) {
    content = '请在设置中开启「保存到相册」权限后重试';
  } else if (raw.length > 60) {
    content = raw.slice(0, 60) + '…';
  }
  wx.showModal({
    title: '保存失败',
    content,
    showCancel: _isAuthError(err),
    confirmText: _isAuthError(err) ? '去设置' : '知道了',
    success: (r) => {
      if (r.confirm && _isAuthError(err) && wx.openSetting) wx.openSetting();
    }
  });
}

async function saveRemoteImageToAlbum(url) {
  await privacyUtil.ensurePrivacyAuthorized();
  await ensureWritePhotosAlbum();
  const isRemote = /^https?:\/\//i.test(url || '') || String(url || '').indexOf('cloud://') === 0;
  let showedDownloadLoading = false;
  if (isRemote && wx.showLoading) {
    wx.showLoading({ title: '正在下载高清图…', mask: false });
    showedDownloadLoading = true;
  }
  try {
    const filePath = await resolveImageLocalPath(url);
    if (showedDownloadLoading && wx.hideLoading) wx.hideLoading();
    showedDownloadLoading = false;
    try {
      await saveToAlbum(filePath);
      return true;
    } catch (e1) {
      logger.warn('[image] direct save fail, retry with copy', _errMsg(e1, ''));
      const copied = await copyToUserDataPath(filePath);
      await saveToAlbum(copied);
      return true;
    }
  } finally {
    if (showedDownloadLoading && wx.hideLoading) wx.hideLoading();
  }
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

module.exports = {
  compress,
  saveToAlbum,
  saveRemoteImageToAlbum,
  showSaveError,
  pickHandPhoto,
  resolveBundledPhoto,
  downloadRemoteHand,
  resolveImageLocalPath
};
