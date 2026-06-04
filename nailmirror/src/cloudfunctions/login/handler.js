/**
 * login 云函数 — 从小程序调用上下文返回 OPENID，并 upsert users 集合
 *
 * users 字段（下划线，与云库 schema 一致）：
 *   _id=openid, nickname, avatar_url, role, is_member, created_at, updated_at, last_login_at
 */

function ok(data) {
  return { code: 0, message: 'ok', data: data || {} };
}

function fail(message) {
  return { code: 1, message: message || 'error', data: null };
}

/** 前端 temp 路径无法持久化，仅保留 https / cloud:// */
function _normalizeAvatarUrl(url) {
  if (!url || typeof url !== 'string') return '';
  if (/^https?:\/\//i.test(url) || url.indexOf('cloud://') === 0) return url;
  return '';
}

/**
 * 登录时 upsert users 文档（_id = openid）
 * @returns {object|null} 已有或新建的用户文档字段
 */
async function upsertUser(cloud, openid, profile) {
  if (!cloud.database) return null;
  const db = cloud.database();
  const ref = db.collection('users').doc(openid);
  const nickname = (profile && profile.nickname) || '';
  const avatarUrl = _normalizeAvatarUrl(profile && profile.avatarUrl);
  const now = db.serverDate();

  let existing = null;
  try {
    const doc = await ref.get();
    existing = doc.data || null;
  } catch (e) {
    // 文档不存在时 get 可能抛错，视为新用户
  }

  if (existing) {
    const patch = {
      updated_at: now,
      last_login_at: now,
    };
    if (nickname) patch.nickname = nickname;
    if (avatarUrl) patch.avatar_url = avatarUrl;
    await ref.update({ data: patch });
    return Object.assign({}, existing, patch);
  }

  const data = {
    nickname: nickname || '微信用户',
    avatar_url: avatarUrl,
    role: 'c',
    is_member: false,
    created_at: now,
    updated_at: now,
    last_login_at: now,
  };
  await ref.set({ data });
  return Object.assign({ _id: openid }, data);
}

async function login(event, deps) {
  const cloud = (deps && deps.cloud) || require('wx-server-sdk');
  const ctx = cloud.getWXContext ? cloud.getWXContext() : {};
  const openid = ctx.OPENID;
  if (!openid) {
    return fail('未授权：请从小程序内调用');
  }
  const ev = event || {};
  const profile = {
    nickname: ev.nickname || '',
    avatarUrl: ev.avatarUrl || '',
  };

  const saved = await upsertUser(cloud, openid, profile);

  const nickname = profile.nickname || (saved && saved.nickname) || '';
  const avatarUrl = profile.avatarUrl || (saved && saved.avatar_url) || '';
  const role = (saved && saved.role) || 'c';
  const isMember = !!(saved && saved.is_member);

  return ok({
    openid,
    role,
    nickname,
    avatarUrl,
    isMember,
  });
}

async function handle(event, context) {
  const cloud = require('wx-server-sdk');
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
  const action = (event && event.action) || 'login';
  if (action === 'login') {
    return login(event, { cloud });
  }
  return fail('未知 action: ' + action);
}

module.exports = { login, handle, upsertUser, _normalizeAvatarUrl };
