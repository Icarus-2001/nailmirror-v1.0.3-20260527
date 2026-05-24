// UserService: login / getProfile
const { mockDelay } = require('../utils/request');
const { userStore } = require('../stores/user.store');
const eventBus = require('../utils/event-bus');
const { EVT_USER_LOGIN } = require('../config/constants');

function _wxLoginCode() {
  return new Promise((resolve) => {
    if (!wx.login) { resolve('mock-code-' + Date.now()); return; }
    wx.login({
      success: (res) => resolve(res.code || 'mock-code-' + Date.now()),
      fail: () => resolve('mock-code-' + Date.now())
    });
  });
}

async function login() {
  const code = await _wxLoginCode();
  return mockDelay(() => {
    // Mock code2Session 返回
    const openid = 'mock-openid-' + (code.length > 5 ? code.slice(-6) : code);
    const user = {
      openid,
      nickname: '美甲控',
      avatarUrl: 'https://picsum.photos/seed/user-me/120/120',
      role: 'c',
      membershipLevel: 0,
      lastRemoveDate: '2026-04-20'
    };
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
