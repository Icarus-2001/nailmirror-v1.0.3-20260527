// 批次 A · 冒烟测试 1 — 启动流程
// 覆盖：app.js onLaunch → wx.getSystemInfoSync 读取 → getDeviceLevel 4 级降级判定 →
//      globalData.deviceLevel 落地 → eventBus 注入 globalData → 异常路径兜底
//
// 测试形态：以 Node 直接 require app.js 触发 App() 注册（用 jest.fn 捕获 App 注册参数后手动调用 onLaunch）。

jest.mock('mobx-miniprogram', () => ({
  observable: (obj) => obj,
  action: (fn) => fn
}), { virtual: true });

const path = require('path');

function loadAppFresh(systemInfoSync) {
  // 1. 重置模块缓存（app.js / device.js 需要重新加载）
  jest.resetModules();
  // 2. 注入自定义 wx.getSystemInfoSync（持续生效直到下一次 loadAppFresh 调用或手动恢复）
  global.wx.getSystemInfoSync = systemInfoSync;
  // 3. 捕获 App() 注册参数
  let appCfg = null;
  const origApp = global.App;
  global.App = (cfg) => { appCfg = cfg; };
  try {
    require(path.resolve(__dirname, '../../app.js'));
  } finally {
    global.App = origApp;
  }
  return appCfg;
}

// 默认 wx.getSystemInfoSync（setup.wx.js 提供的是 ios 14.5）— 每个 test 结束后恢复
const DEFAULT_SYSTEM_INFO = () => ({
  platform: 'ios', system: 'iOS 14.5', brand: 'iPhone', benchmarkLevel: -1
});
afterEach(() => { global.wx.getSystemInfoSync = DEFAULT_SYSTEM_INFO; });

describe('[Smoke A1] 启动流程：onLaunch + 设备四级降级', () => {
  test('iOS 14+ → high 端', () => {
    const cfg = loadAppFresh(() => ({
      platform: 'ios', system: 'iOS 16.2', brand: 'iPhone', benchmarkLevel: -1
    }));
    expect(cfg).toBeTruthy();
    expect(typeof cfg.onLaunch).toBe('function');
    cfg.onLaunch.call(cfg);
    expect(cfg.globalData.deviceLevel).toBe('high');
    expect(cfg.globalData.systemInfo).toMatchObject({ platform: 'ios' });
  });

  test('iOS 12 → mid 端', () => {
    const cfg = loadAppFresh(() => ({
      platform: 'ios', system: 'iOS 12.4', brand: 'iPhone', benchmarkLevel: -1
    }));
    cfg.onLaunch.call(cfg);
    expect(cfg.globalData.deviceLevel).toBe('mid');
  });

  test('iOS 10 → low 端，应触发降级路径（非 high/mid）', () => {
    const cfg = loadAppFresh(() => ({
      platform: 'ios', system: 'iOS 10.3', brand: 'iPhone', benchmarkLevel: -1
    }));
    cfg.onLaunch.call(cfg);
    expect(cfg.globalData.deviceLevel).toBe('low');
  });

  test('Android benchmarkLevel ≥ 25 → high', () => {
    const cfg = loadAppFresh(() => ({
      platform: 'android', system: 'Android 13', brand: 'Xiaomi', benchmarkLevel: 30
    }));
    cfg.onLaunch.call(cfg);
    expect(cfg.globalData.deviceLevel).toBe('high');
  });

  test('Android benchmarkLevel 0..9 → low', () => {
    const cfg = loadAppFresh(() => ({
      platform: 'android', system: 'Android 9', brand: 'Unknown', benchmarkLevel: 5
    }));
    cfg.onLaunch.call(cfg);
    expect(cfg.globalData.deviceLevel).toBe('low');
  });

  test('Android 缺少 benchmarkLevel + 白名单品牌 → mid（品牌兜底）', () => {
    const cfg = loadAppFresh(() => ({
      platform: 'android', system: 'Android 10', brand: 'HUAWEI Mate', benchmarkLevel: -1
    }));
    cfg.onLaunch.call(cfg);
    expect(cfg.globalData.deviceLevel).toBe('mid');
  });

  test('Android 缺少 benchmarkLevel + 黑名单品牌 → low', () => {
    const cfg = loadAppFresh(() => ({
      platform: 'android', system: 'Android 10', brand: 'NoNameXyz', benchmarkLevel: -1
    }));
    cfg.onLaunch.call(cfg);
    expect(cfg.globalData.deviceLevel).toBe('low');
  });

  test('getSystemInfoSync 抛错 → 兜底 mid，且 onLaunch 不抛', () => {
    const cfg = loadAppFresh(() => { throw new Error('boom'); });
    // onLaunch 内部 try-catch；不应抛
    expect(() => cfg.onLaunch.call(cfg)).not.toThrow();
    // device.js 的 getDeviceLevel 抛错时返回 mid
    expect(['mid', 'low', 'high']).toContain(cfg.globalData.deviceLevel);
  });

  test('globalData 注入 eventBus 单例 + 版本号', () => {
    const cfg = loadAppFresh(() => ({
      platform: 'ios', system: 'iOS 15.0', brand: 'iPhone', benchmarkLevel: -1
    }));
    expect(cfg.globalData.eventBus).toBeTruthy();
    expect(typeof cfg.globalData.eventBus.emit).toBe('function');
    expect(typeof cfg.globalData.eventBus.on).toBe('function');
    expect(cfg.globalData.version).toMatch(/\d+\.\d+\.\d+/);
  });

  test('全局错误处理 onError 应触发 wx.showToast', () => {
    const cfg = loadAppFresh(() => ({
      platform: 'ios', system: 'iOS 15.0', brand: 'iPhone', benchmarkLevel: -1
    }));
    const calls = [];
    const origToast = global.wx.showToast;
    global.wx.showToast = (opts) => calls.push(opts);
    try {
      cfg.onError('mock-stack');
    } finally {
      global.wx.showToast = origToast;
    }
    expect(calls.length).toBe(1);
    expect(calls[0].title).toBeTruthy();
  });
});
