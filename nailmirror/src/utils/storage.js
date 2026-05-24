// wx.storage 封装
function safeGet(key, def) {
  try {
    const v = wx.getStorageSync(key);
    if (v === '' || v === null || v === undefined) return def;
    return v;
  } catch (e) {
    return def;
  }
}
function safeSet(key, val) {
  try { wx.setStorageSync(key, val); return true; } catch (e) { return false; }
}
function safeRemove(key) {
  try { wx.removeStorageSync(key); return true; } catch (e) { return false; }
}

module.exports = { safeGet, safeSet, safeRemove };
