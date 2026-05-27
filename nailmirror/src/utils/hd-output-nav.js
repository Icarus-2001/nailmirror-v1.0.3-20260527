// 高清出片页跳转：hdUrl 过长，不宜放在 query 里
const { STORAGE_HD_OUTPUT } = require('../config/constants');

function _setPendingHdUrl(hdUrl) {
  try {
    if (hdUrl) wx.setStorageSync(STORAGE_HD_OUTPUT, hdUrl);
  } catch (e) { /* ignore */ }
  try {
    const app = getApp();
    if (app && app.globalData) app.globalData.pendingHdUrl = hdUrl || '';
  } catch (e) { /* ignore */ }
}

function _takePendingHdUrl() {
  let url = '';
  try {
    const app = getApp();
    url = (app && app.globalData && app.globalData.pendingHdUrl) || '';
    if (app && app.globalData) app.globalData.pendingHdUrl = '';
  } catch (e) { /* ignore */ }
  if (!url) {
    try {
      url = wx.getStorageSync(STORAGE_HD_OUTPUT) || '';
      if (url) wx.removeStorageSync(STORAGE_HD_OUTPUT);
    } catch (e) { /* ignore */ }
  }
  return url;
}

function navigateTo(styleId, hdUrl) {
  _setPendingHdUrl(hdUrl);
  const q = styleId ? '?styleId=' + encodeURIComponent(styleId) : '';
  wx.navigateTo({ url: '/pages/hd-output/index' + q });
}

function resolveHdUrl(query) {
  let url = _takePendingHdUrl();
  if (!url && query && query.hdUrl) {
    try {
      url = decodeURIComponent(query.hdUrl);
    } catch (e) { /* ignore */ }
  }
  return url;
}

module.exports = { navigateTo, resolveHdUrl };
