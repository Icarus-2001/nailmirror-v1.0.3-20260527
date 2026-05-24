describe('utils/device', () => {
  let getDeviceLevel;
  beforeEach(() => {
    jest.resetModules();
  });

  test('iOS 14 → high', () => {
    global.wx.getSystemInfoSync = () => ({ platform: 'ios', system: 'iOS 14.5', brand: 'iPhone', benchmarkLevel: -1 });
    getDeviceLevel = require('../../utils/device').getDeviceLevel;
    expect(getDeviceLevel()).toBe('high');
  });

  test('iOS 12 → mid', () => {
    global.wx.getSystemInfoSync = () => ({ platform: 'ios', system: 'iOS 12.5', brand: 'iPhone', benchmarkLevel: -1 });
    getDeviceLevel = require('../../utils/device').getDeviceLevel;
    expect(getDeviceLevel()).toBe('mid');
  });

  test('Android benchmarkLevel 30 → high', () => {
    global.wx.getSystemInfoSync = () => ({ platform: 'android', system: 'Android 11', brand: 'huawei', benchmarkLevel: 30 });
    getDeviceLevel = require('../../utils/device').getDeviceLevel;
    expect(getDeviceLevel()).toBe('high');
  });

  test('Android benchmarkLevel 5 → low', () => {
    global.wx.getSystemInfoSync = () => ({ platform: 'android', system: 'Android 9', brand: 'unknown', benchmarkLevel: 5 });
    getDeviceLevel = require('../../utils/device').getDeviceLevel;
    expect(getDeviceLevel()).toBe('low');
  });

  test('Android 不支持 benchmarkLevel + 白名单 → mid', () => {
    global.wx.getSystemInfoSync = () => ({ platform: 'android', system: 'Android 11', brand: 'xiaomi', benchmarkLevel: -1 });
    getDeviceLevel = require('../../utils/device').getDeviceLevel;
    expect(getDeviceLevel()).toBe('mid');
  });
});
