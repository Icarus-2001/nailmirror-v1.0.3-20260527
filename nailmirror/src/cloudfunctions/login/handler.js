/**
 * login 云函数 — 从小程序调用上下文返回 OPENID（无需自建 code2Session）
 */

function ok(data) {
  return { code: 0, message: 'ok', data: data || {} };
}

function fail(message) {
  return { code: 1, message: message || 'error', data: null };
}

async function login(event, deps) {
  const cloud = (deps && deps.cloud) || require('wx-server-sdk');
  const ctx = cloud.getWXContext ? cloud.getWXContext() : {};
  const openid = ctx.OPENID;
  if (!openid) {
    return fail('未授权：请从小程序内调用');
  }
  const ev = event || {};
  return ok({
    openid,
    role: 'c',
    nickname: ev.nickname || '',
    avatarUrl: ev.avatarUrl || ''
  });
}

async function handle(event, context) {
  const cloud = require('wx-server-sdk');
  const action = (event && event.action) || 'login';
  if (action === 'login') {
    return login(event, { cloud });
  }
  return fail('未知 action: ' + action);
}

module.exports = { login, handle };
