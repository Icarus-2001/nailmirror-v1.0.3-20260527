// 统一 Mock 请求：注入随机延迟 + 可选失败注入
const featureFlags = require('../config/feature-flags');
const ERR = require('../config/error-codes');

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomInRange(min, max) {
  return min + Math.floor(Math.random() * (max - min));
}

/**
 * 包装任意同步返回值为带延迟的 Promise
 * @param {() => any | Promise<any>} fn
 * @param {number} min
 * @param {number} max
 * @param {object} opts
 */
async function mockDelay(fn, min = 100, max = 200, opts = {}) {
  const dur = randomInRange(min, max + 1);
  await delay(dur);

  // 失败注入
  if (featureFlags.MOCK_FAILURE_ENABLE && Math.random() < featureFlags.MOCK_FAILURE_RATE) {
    if (!opts.noInjectFail) {
      const err = { code: ERR.NETWORK_ERR, message: '网络波动（mock 注入）', raw: null };
      throw err;
    }
  }

  return typeof fn === 'function' ? fn() : fn;
}

function makeError(code, message, raw) {
  return { code, message: message || code, raw: raw || null };
}

module.exports = { mockDelay, makeError, delay, randomInRange };
