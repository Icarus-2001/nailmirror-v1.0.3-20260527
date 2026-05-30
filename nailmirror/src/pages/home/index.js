// V1.6 主页 — 自包含兜底数据 + 异步服务可选
const featureFlags = require('../../config/feature-flags');

function getInitialHotKeywords() {
  if (featureFlags.USE_REAL_STYLES) {
    try {
      const { buildRealHotKeywords } = require('../../services/hot-data.service');
      const kws = buildRealHotKeywords();
      if (kws.length) return kws.slice(0, 6);
    } catch (e) { /* ignore */ }
  }
  return [
    { word: '法式极简', platform: 'xhs', heat: 98210 },
    { word: '猫眼美甲', platform: 'xhs', heat: 95340 },
    { word: '奶茶色系', platform: 'douyin', heat: 92105 },
    { word: '星河流光', platform: 'xhs', heat: 89010 },
    { word: '复古酒红', platform: 'weibo', heat: 85622 },
    { word: '镜面银', platform: 'xhs', heat: 82014 }
  ];
}

const FALLBACK_STYLES = [
  { id: 'french-01', title: '法式极简·裸粉', coverUrl: '', heat: 98210, styleTags: ['法式', '极简'] },
  { id: 'cool-01', title: '冷酷·星河流光', coverUrl: '', heat: 89010, styleTags: ['冷酷', '亮片'] },
  { id: 'cream-01', title: '温柔·奶茶色系', coverUrl: '', heat: 92105, styleTags: ['温柔', '奶茶'] },
  { id: 'glitter-01', title: '亮片·星夜璀璨', coverUrl: '', heat: 66220, styleTags: ['亮片', '派对'] }
];

function getInitialStyles() {
  if (featureFlags.USE_REAL_STYLES) {
    try {
      const real = require('../../mock/styles.real').filter((s) => s.isActive !== false);
      if (real.length) {
        return real.slice().sort((a, b) => (b.heat || 0) - (a.heat || 0)).slice(0, 4);
      }
    } catch (e) { /* ignore */ }
  }
  return FALLBACK_STYLES;
}

Page({
  data: {
    userName: '美甲控',
    quickStyles: getInitialStyles(),
    hotKeywords: getInitialHotKeywords(),
    loaded: true
  },
  onLoad() {
    // 优先用兜底数据立刻渲染，再尝试异步替换为真实数据
    try {
      const { userStore } = require('../../stores/user.store');
      if (userStore && typeof userStore.init === 'function') {
        userStore.init();
        if (userStore.nickname) this.setData({ userName: userStore.nickname });
      }
    } catch (e) {
      console.warn('[home] userStore init skipped:', e && e.message);
    }

    // 异步加载真实 mock 数据，失败时保持兜底
    this.loadAsyncData();
  },
  loadAsyncData() {
    try {
      const styleService = require('../../services/style.service');
      const hotDataService = require('../../services/hot-data.service');
      Promise.all([
        styleService.list({ page: 1, pageSize: 4 }).catch(() => null),
        hotDataService.fetchTop20().catch(() => null)
      ]).then(([list, kws]) => {
        const update = {};
        if (list && list.items && list.items.length) update.quickStyles = list.items.slice(0, 4);
        if (kws && kws.length) update.hotKeywords = kws.slice(0, 6);
        if (Object.keys(update).length) this.setData(update);
      }).catch((err) => {
        console.warn('[home] async load failed:', err && err.message);
      });
    } catch (e) {
      console.warn('[home] services unavailable:', e && e.message);
    }
  },
  onGoTryOn() { wx.navigateTo({ url: '/pages/try-on-static/index' }); },
  onGoHotRank() { wx.navigateTo({ url: '/pages/hot-rank/index' }); },
  onGoLibrary() { wx.navigateTo({ url: '/pages/style-library/index' }); },
  onGoMembership() { wx.navigateTo({ url: '/pages/me-membership/index' }); },
  onStyleTap(e) {
    const id = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id)
      || (e && e.detail && e.detail.style && e.detail.style.id);
    if (id) wx.navigateTo({ url: '/pages/style-detail/index?id=' + id });
  },
  onKeywordTap(e) {
    const word = e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.word;
    if (word) {
      wx.navigateTo({ url: '/pages/style-library/index?keyword=' + encodeURIComponent(word) });
    }
  }
});
