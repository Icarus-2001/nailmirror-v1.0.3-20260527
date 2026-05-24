// C1 单测：utils/device.js — 设备分级 / 降级判定
// 对应 PRD 四级降级策略（iOS 版本 + Android benchmarkLevel + 异常兜底 + 品牌白名单）

describe('utils/device — getDeviceLevel', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('happy path: iOS 14.5 → high（走 AR）', () => {
    global.wx.getSystemInfoSync = () => ({
      platform: 'ios', system: 'iOS 14.5', brand: 'iPhone', benchmarkLevel: -1
    });
    const { getDeviceLevel } = require('../../utils/device');
    expect(getDeviceLevel()).toBe('high');
  });

  test('happy path: Android benchmarkLevel=30 → high（走 AR）', () => {
    global.wx.getSystemInfoSync = () => ({
      platform: 'android', system: 'Android 12', brand: 'huawei', benchmarkLevel: 30
    });
    const { getDeviceLevel } = require('../../utils/device');
    expect(getDeviceLevel()).toBe('high');
  });

  test('边界: iOS 12.0 → mid（>=12 但 <14）', () => {
    global.wx.getSystemInfoSync = () => ({
      platform: 'ios', system: 'iOS 12.0', brand: 'iPhone', benchmarkLevel: -1
    });
    const { getDeviceLevel } = require('../../utils/device');
    expect(getDeviceLevel()).toBe('mid');
  });

  test('边界: iOS 11.x → low（低于 12）', () => {
    global.wx.getSystemInfoSync = () => ({
      platform: 'ios', system: 'iOS 11.4', brand: 'iPhone', benchmarkLevel: -1
    });
    const { getDeviceLevel } = require('../../utils/device');
    expect(getDeviceLevel()).toBe('low');
  });

  test('边界: Android benchmarkLevel=10 → mid（>=10 且 <25）', () => {
    global.wx.getSystemInfoSync = () => ({
      platform: 'android', system: 'Android 11', brand: 'xiaomi', benchmarkLevel: 10
    });
    const { getDeviceLevel } = require('../../utils/device');
    expect(getDeviceLevel()).toBe('mid');
  });

  test('边界: Android benchmarkLevel=24 → mid（紧邻 high 阈值下方）', () => {
    global.wx.getSystemInfoSync = () => ({
      platform: 'android', system: 'Android 12', brand: 'oppo', benchmarkLevel: 24
    });
    const { getDeviceLevel } = require('../../utils/device');
    expect(getDeviceLevel()).toBe('mid');
  });

  test('Android benchmarkLevel=5 → low（<10）', () => {
    global.wx.getSystemInfoSync = () => ({
      platform: 'android', system: 'Android 9', brand: 'unknown', benchmarkLevel: 5
    });
    const { getDeviceLevel } = require('../../utils/device');
    expect(getDeviceLevel()).toBe('low');
  });

  test('异常: getSystemInfoSync 抛错 → 兜底 mid', () => {
    global.wx.getSystemInfoSync = () => { throw new Error('boom'); };
    const { getDeviceLevel } = require('../../utils/device');
    expect(getDeviceLevel()).toBe('mid');
  });

  test('Android 不支持 benchmarkLevel + 品牌白名单（xiaomi） → mid', () => {
    global.wx.getSystemInfoSync = () => ({
      platform: 'android', system: 'Android 11', brand: 'xiaomi', benchmarkLevel: -1
    });
    const { getDeviceLevel } = require('../../utils/device');
    expect(getDeviceLevel()).toBe('mid');
  });

  test('Android 不支持 benchmarkLevel + 品牌不在白名单 → low（fallback）', () => {
    global.wx.getSystemInfoSync = () => ({
      platform: 'android', system: 'Android 8', brand: 'no-name-brand', benchmarkLevel: -1
    });
    const { getDeviceLevel } = require('../../utils/device');
    expect(getDeviceLevel()).toBe('low');
  });

  test('未知 platform → mid（默认安全档）', () => {
    global.wx.getSystemInfoSync = () => ({
      platform: 'devtools', system: 'macOS 13', brand: 'Apple', benchmarkLevel: -1
    });
    const { getDeviceLevel } = require('../../utils/device');
    expect(getDeviceLevel()).toBe('mid');
  });
});
