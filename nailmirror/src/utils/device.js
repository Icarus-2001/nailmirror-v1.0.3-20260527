// 设备分级算法（参考架构文档 §8.1）
const { DEVICE_LEVELS } = require('../config/enums');

function getDeviceLevel() {
  let info;
  try {
    info = wx.getSystemInfoSync();
  } catch (e) {
    return DEVICE_LEVELS.MID;
  }
  const { platform = 'unknown', brand = '', system = '', benchmarkLevel } = info || {};

  if (platform === 'ios') {
    const m = system.match(/\d+/);
    const majorVer = m ? parseInt(m[0], 10) : 0;
    if (majorVer >= 14) return DEVICE_LEVELS.HIGH;
    if (majorVer >= 12) return DEVICE_LEVELS.MID;
    return DEVICE_LEVELS.LOW;
  }

  if (platform === 'android') {
    if (benchmarkLevel >= 25) return DEVICE_LEVELS.HIGH;
    if (benchmarkLevel >= 10) return DEVICE_LEVELS.MID;
    if (benchmarkLevel >= 0)  return DEVICE_LEVELS.LOW;
    const goodBrands = /huawei|honor|xiaomi|oppo|vivo|samsung/i;
    return goodBrands.test(brand) ? DEVICE_LEVELS.MID : DEVICE_LEVELS.LOW;
  }

  return DEVICE_LEVELS.MID;
}

module.exports = { getDeviceLevel };
