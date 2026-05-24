// C1 单测：utils/storage.js — wx.storage 包装

describe('utils/storage', () => {
  let storage;
  beforeEach(() => {
    jest.resetModules();
    storage = require('../../utils/storage');
  });

  test('set/get 一致：safeSet 后 safeGet 返回相同值', () => {
    expect(storage.safeSet('user', { id: 1, name: 'a' })).toBe(true);
    expect(storage.safeGet('user', null)).toEqual({ id: 1, name: 'a' });
  });

  test('不存在的 key 返回默认值', () => {
    expect(storage.safeGet('nope', null)).toBe(null);
    expect(storage.safeGet('nope2', 'fallback')).toBe('fallback');
    expect(storage.safeGet('nope3')).toBeUndefined();
  });

  test('getStorageSync 抛错 → 返回默认值', () => {
    const orig = global.wx.getStorageSync;
    global.wx.getStorageSync = () => { throw new Error('storage broken'); };
    try {
      expect(storage.safeGet('any', 'def')).toBe('def');
    } finally {
      global.wx.getStorageSync = orig;
    }
  });

  test('setStorageSync 抛错 → safeSet 返回 false（不抛错）', () => {
    const orig = global.wx.setStorageSync;
    global.wx.setStorageSync = () => { throw new Error('quota exceeded'); };
    try {
      expect(storage.safeSet('k', 'v')).toBe(false);
    } finally {
      global.wx.setStorageSync = orig;
    }
  });

  test('safeRemove：删除后 safeGet 取回默认值', () => {
    storage.safeSet('tmp', 123);
    expect(storage.safeGet('tmp', null)).toBe(123);
    expect(storage.safeRemove('tmp')).toBe(true);
    expect(storage.safeGet('tmp', null)).toBe(null);
  });

  test('空字符串 / null / undefined 视为缺省，回退到默认值', () => {
    storage.safeSet('empty', '');
    expect(storage.safeGet('empty', 'def')).toBe('def');
  });
});
