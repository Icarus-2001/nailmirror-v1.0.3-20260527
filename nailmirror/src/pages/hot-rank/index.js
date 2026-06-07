const hotDataService = require('../../services/hot-data.service');
const { getRankRules } = require('../../config/hot-rank-rules');

const SITE_NOTICE = '每日 10 点更新，主要按【平台特供】和【来自商家】两类美甲款式的热度 Top10 排序';

Page({
  data: {
    activeTab: 'external',
    items: [],
    updatedAt: '',
    pageTitle: '全网热款 TOP10',
    notice: '',
    loading: false,
    ruleVisible: false,
    ruleTitle: '',
    ruleParagraphs: [],
    _externalCache: null,
    _siteCache: null,
  },
  async onLoad() {
    await this._loadTab('external');
  },
  async onTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.activeTab) return;
    this.setData({ activeTab: tab });
    await this._loadTab(tab);
  },
  async _loadTab(tab) {
    const cacheKey = tab === 'site' ? '_siteCache' : '_externalCache';
    const cached = this.data[cacheKey];
    if (cached) {
      this._applyRank(tab, cached);
      return;
    }
    this.setData({ loading: true });
    try {
      const rank = tab === 'site'
        ? await hotDataService.fetchSiteRanking()
        : await hotDataService.fetchRanking();
      const patch = {};
      patch[cacheKey] = rank;
      this.setData(patch);
      this._applyRank(tab, rank);
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },
  _applyRank(tab, rank) {
    const isSite = tab === 'site';
    this.setData({
      items: (rank && rank.items) || [],
      updatedAt: (rank && rank.updatedAt) || '',
      pageTitle: isSite ? '站内热度 TOP10' : '全网热款 TOP10',
      notice: isSite ? SITE_NOTICE : '',
      loading: false,
    });
  },
  onShowRules() {
    const rules = getRankRules(this.data.activeTab);
    this.setData({
      ruleVisible: true,
      ruleTitle: rules.title,
      ruleParagraphs: rules.paragraphs
    });
  },
  onCloseRules() {
    this.setData({ ruleVisible: false });
  },
});
