/**
 * 解析调用者 openid：优先云函数上下文 OPENID，其次客户端传参
 */
function resolveOpenid(fallback) {
  const cloud = require('wx-server-sdk')
  const ctx = cloud.getWXContext ? cloud.getWXContext() : {}
  const fromCtx = (ctx.OPENID || '').trim()
  const fromEvent = (fallback || '').trim()
  return fromCtx || fromEvent
}

module.exports = { resolveOpenid }
