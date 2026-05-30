// UserService: login / getProfile
const { mockDelay } = require('../utils/request');
const { userStore } = require('../stores/user.store');
const eventBus = require('../utils/event-bus');
const { EVT_USER_LOGIN } = require('../config/constants');
const featureFlags = require('../config/feature-flags');
const cloudUtil = require('../utils/cloud');
const logger = require('../utils/logger');

function _wxLoginCode() {
  return new Promise((resolve) => {
    if (!wx.login) { resolve('mock-code-' + Date.now()); return; }
    wx.login({
      success: (res) => resolve(res.code || 'mock-code-' + Date.now()),
      fail: () => resolve('mock-code-' + Date.now())
    });
  });
}

function _mockUserFromCode(code) {
  const openid = 'mock-openid-' + (code.length > 5 ? code.slice(-6) : code);
  return {
    openid,
    nickname: '美甲控',
      avatarUrl: '',
    role: 'c',
    membershipLevel: 0,
    lastRemoveDate: '2026-04-20'
  };
}

async function _cloudLogin(profile) {
  const payload = { action: 'login' };
  if (profile && profile.nickname) payload.nickname = profile.nickname;
  if (profile && profile.avatarUrl) payload.avatarUrl = profile.avatarUrl;
  const r = await cloudUtil.callFunction('login', payload);
  if (!r || r.code !== 0 || !r.data || !r.data.openid) {
    throw new Error((r && r.message) || '登录失败');
  }
  return {
    openid: r.data.openid,
    nickname: r.data.nickname || (profile && profile.nickname) || '',
    avatarUrl: r.data.avatarUrl || (profile && profile.avatarUrl) || '',
    role: r.data.role || 'c',
    membershipLevel: 0,
    lastRemoveDate: ''
  };
}

async function login(profile) {
  if (featureFlags.USE_CLOUD_LOGIN && cloudUtil.isCloudReady()) {
    try {
      const user = await _cloudLogin(profile);
      userStore.setUser(user);
      eventBus.emit(EVT_USER_LOGIN, user);
      return user;
    } catch (e) {
      logger.warn('[user] cloud login fail, fallback mock', e.message);
    }
  }
  const code = await _wxLoginCode();
  return mockDelay(() => {
    const user = _mockUserFromCode(code);
    userStore.setUser(user);
    eventBus.emit(EVT_USER_LOGIN, user);
    return user;
  }, 180, 260);
}

async function getProfile() {
  return mockDelay(() => ({
    openid: userStore.openid,
    nickname: userStore.nickname,
    avatarUrl: userStore.avatarUrl,
    role: userStore.role,
    membershipLevel: userStore.membershipLevel,
    lastRemoveDate: userStore.lastRemoveDate,
    dailyFreeHDLeft: userStore.dailyFreeHDLeft
  }), 80, 120);
}

module.exports = { login, getProfile };
