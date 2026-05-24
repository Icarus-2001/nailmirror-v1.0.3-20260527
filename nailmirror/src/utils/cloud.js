// 微信云开发初始化
const logger = require('./logger');
const cloudEnv = require('../config/cloud-env');

let _inited = false;
let _cloudOk = false;

function initCloud() {
  if (_inited) return _cloudOk;
  _inited = true;
  if (!wx.cloud) {
    logger.warn('[cloud] wx.cloud 不可用（请使用非游客模式 + 开通云开发）');
    _cloudOk = false;
    return false;
  }
  try {
    const opts = { traceUser: true };
    if (cloudEnv.ENV_ID) opts.env = cloudEnv.ENV_ID;
    wx.cloud.init(opts);
    _cloudOk = true;
  } catch (e) {
    logger.warn('[cloud] init fail', e);
    _cloudOk = false;
  }
  return _cloudOk;
}

function isCloudReady() {
  return initCloud();
}

function callFunction(name, data) {
  return new Promise((resolve, reject) => {
    if (!initCloud()) {
      reject(new Error('云开发未就绪，请关闭游客模式并开通云开发'));
      return;
    }
    wx.cloud.callFunction({ name, data })
      .then((res) => resolve(res.result))
      .catch(reject);
  });
}

function uploadFile(cloudPath, filePath) {
  return new Promise((resolve, reject) => {
    if (!initCloud()) {
      reject(new Error('云开发未就绪'));
      return;
    }
    wx.cloud.uploadFile({ cloudPath, filePath, success: resolve, fail: reject });
  });
}

module.exports = { initCloud, isCloudReady, callFunction, uploadFile };
