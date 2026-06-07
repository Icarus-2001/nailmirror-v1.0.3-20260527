const { userStore } = require('../../stores/user.store');
const merchantDashboardService = require('../../services/merchant-dashboard.service');
const TREND_RULES = require('../../config/dashboard-trend-rules');

const METRICS = [
  { key: 'uv', label: '商详UV' },
  { key: 'tryon', label: '试戴完成' },
  { key: 'fav', label: '收藏' },
  { key: 'heat', label: '综合热度' },
  { key: 'conversion', label: '试戴转化率' },
];

const LINE_COLORS = ['#7c3aed', '#0ea5e9', '#f59e0b'];
const TAG_TABS = [
  { key: 'color', label: '颜色' },
  { key: 'style', label: '风格' },
  { key: 'design', label: '图案' },
];
const MAX_SELECTED = 3;
const TREND_PAGE_SIZE = 3;

function formatSnapshotText(snapshotDate) {
  if (!snapshotDate) return '';
  return snapshotDate + ' 24:00 · 每日 10:00 更新';
}

function formatWow(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return '0%';
  if (n > 0) return '+' + n + '%';
  return n + '%';
}

function buildSelectedSummary(styleOptions, selectedIds) {
  const names = (selectedIds || []).map((id) => {
    const hit = (styleOptions || []).find((s) => s.id === id);
    return hit ? hit.title : '';
  }).filter(Boolean);
  const n = (selectedIds || []).length;
  if (!names.length) return '请选择对比款式（0/' + MAX_SELECTED + '）';
  return '已选 ' + n + '/' + MAX_SELECTED + '：' + names.join('、');
}

function mapTrendItems(list) {
  return (list || []).map((item) => Object.assign({}, item, {
    wowText: formatWow(item.wowHeat),
  }));
}

function paginateTrends(list, page) {
  const total = (list || []).length;
  const pageCount = Math.max(1, Math.ceil(total / TREND_PAGE_SIZE));
  const safePage = Math.min(Math.max(page || 0, 0), pageCount - 1);
  const start = safePage * TREND_PAGE_SIZE;
  return {
    items: (list || []).slice(start, start + TREND_PAGE_SIZE),
    page: safePage,
    pageCount,
    canPrev: safePage > 0,
    canNext: safePage < pageCount - 1,
    total,
  };
}

Page({
  data: {
    loading: true,
    metrics: METRICS,
    activeMetric: 'heat',
    tagTabs: TAG_TABS,
    activeTagTab: 'color',
    dates: [],
    chartLines: [],
    styleOptions: [],
    selectedIds: [],
    selectedSummary: '',
    stylePickerOpen: false,
    dataHealth: {},
    updatedAtText: '',
    trendsHot: [],
    trendsCold: [],
    hotPage: 0,
    coldPage: 0,
    hotPageCount: 1,
    coldPageCount: 1,
    hotCanPrev: false,
    hotCanNext: false,
    coldCanPrev: false,
    coldCanNext: false,
    hotPageText: '',
    coldPageText: '',
    tagItemsColor: [],
    tagItemsStyle: [],
    tagItemsDesign: [],
    emptyHint: '',
    adviceLoading: false,
    adviceVisible: false,
    adviceContent: '',
    adviceSnapshotDate: '',
  },

  _raw: null,
  _trendsHotAll: [],
  _trendsColdAll: [],

  onShow() {
    userStore.init();
    if (userStore.role !== 'b') {
      wx.showToast({ title: '请先切换商家身份', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 600);
      return;
    }
    this._load();
  },

  async _load() {
    this.setData({ loading: true });
    try {
      const res = await merchantDashboardService.fetchDashboard();
      this._raw = res;
      const selectedIds = (res.overview && res.overview.defaultSelectedIds) || [];
      const styleOptions = (res.styles || []).map((s) => ({
        id: s.id,
        title: s.title,
        heatNow: s.heatNow,
        checked: selectedIds.indexOf(s.id) >= 0,
      }));

      this._trendsHotAll = mapTrendItems((res.trends && res.trends.hot) || []);
      this._trendsColdAll = mapTrendItems((res.trends && res.trends.cold) || []);

      this.setData({
        loading: false,
        dates: (res.overview && res.overview.dates) || [],
        styleOptions,
        selectedIds: selectedIds.slice(0, MAX_SELECTED),
        selectedSummary: buildSelectedSummary(styleOptions, selectedIds),
        stylePickerOpen: false,
        dataHealth: res.dataHealth || {},
        updatedAtText: formatSnapshotText(res.snapshotDate),
        hotPage: 0,
        coldPage: 0,
        emptyHint: (res.dataHealth && res.dataHealth.message) || '',
        tagItemsColor: this._tagItems(res, 'color'),
        tagItemsStyle: this._tagItems(res, 'style'),
        tagItemsDesign: this._tagItems(res, 'design'),
      });
      this._applyTrendPages();
      this._refreshChart();
      this._redrawChart();
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: (e.message || '加载失败').slice(0, 20), icon: 'none' });
    }
  },

  _applyTrendPages() {
    const hot = paginateTrends(this._trendsHotAll, this.data.hotPage);
    const cold = paginateTrends(this._trendsColdAll, this.data.coldPage);
    this.setData({
      trendsHot: hot.items,
      trendsCold: cold.items,
      hotPage: hot.page,
      coldPage: cold.page,
      hotPageCount: hot.pageCount,
      coldPageCount: cold.pageCount,
      hotCanPrev: hot.canPrev,
      hotCanNext: hot.canNext,
      coldCanPrev: cold.canPrev,
      coldCanNext: cold.canNext,
      hotPageText: hot.total ? ('第 ' + (hot.page + 1) + '/' + hot.pageCount + ' 页') : '',
      coldPageText: cold.total ? ('第 ' + (cold.page + 1) + '/' + cold.pageCount + ' 页') : '',
    });
  },

  _tagItems(res, tab) {
    const analysis = (res && res.tagAnalysis) || {};
    return (analysis[tab] || []).map((item) => ({
      label: item.tag,
      value: item.styleCount != null ? item.styleCount : 0,
      sub: item.heatSum != null ? item.heatSum : 0,
    }));
  },

  _refreshChart() {
    const res = this._raw;
    if (!res || !res.overview) {
      this.setData({ chartLines: [] });
      return;
    }
    const metric = this.data.activeMetric;
    const seriesByStyle = res.overview.seriesByStyle || {};
    const styleMap = {};
    (res.styles || []).forEach((s) => { styleMap[s.id] = s.title; });

    const lines = (this.data.selectedIds || []).map((id, idx) => {
      const series = seriesByStyle[id] || {};
      return {
        name: styleMap[id] || id,
        color: LINE_COLORS[idx % LINE_COLORS.length],
        values: series[metric] || [],
      };
    });
    this.setData({ chartLines: lines });
    this._redrawChart();
  },

  _redrawChart() {
    wx.nextTick(() => {
      const chart = this.selectComponent('#bdLineChart');
      if (chart && chart.redraw) chart.redraw();
    });
  },

  onMetricTap(e) {
    const key = e.currentTarget.dataset.key;
    if (!key || key === this.data.activeMetric) return;
    this.setData({ activeMetric: key });
    this._refreshChart();
  },

  onTagTabTap(e) {
    const key = e.currentTarget.dataset.key;
    if (!key || key === this.data.activeTagTab) return;
    this.setData({ activeTagTab: key });
  },

  onToggleStylePicker() {
    this.setData({ stylePickerOpen: !this.data.stylePickerOpen });
  },

  onCloseStylePicker() {
    this.setData({ stylePickerOpen: false });
  },

  onToggleStyle(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    let selected = this.data.selectedIds.slice();
    const idx = selected.indexOf(id);
    if (idx >= 0) {
      selected.splice(idx, 1);
    } else {
      if (selected.length >= MAX_SELECTED) {
        wx.showToast({ title: '最多同时对比3个款式', icon: 'none' });
        return;
      }
      selected.push(id);
    }
    const styleOptions = this.data.styleOptions.map((s) => Object.assign({}, s, {
      checked: selected.indexOf(s.id) >= 0,
    }));
    this.setData({
      selectedIds: selected,
      styleOptions,
      selectedSummary: buildSelectedSummary(styleOptions, selected),
    });
    this._refreshChart();
  },

  onHotPrev() {
    if (!this.data.hotCanPrev) return;
    this.setData({ hotPage: this.data.hotPage - 1 });
    this._applyTrendPages();
  },

  onHotNext() {
    if (!this.data.hotCanNext) return;
    this.setData({ hotPage: this.data.hotPage + 1 });
    this._applyTrendPages();
  },

  onColdPrev() {
    if (!this.data.coldCanPrev) return;
    this.setData({ coldPage: this.data.coldPage - 1 });
    this._applyTrendPages();
  },

  onColdNext() {
    if (!this.data.coldCanNext) return;
    this.setData({ coldPage: this.data.coldPage + 1 });
    this._applyTrendPages();
  },

  onShowHotRules() {
    wx.showModal({
      title: TREND_RULES.hotTitle,
      content: TREND_RULES.hotBody,
      showCancel: false,
      confirmText: '知道了',
    });
  },

  onShowColdRules() {
    wx.showModal({
      title: TREND_RULES.coldTitle,
      content: TREND_RULES.coldBody,
      showCancel: false,
      confirmText: '知道了',
    });
  },

  async onTapAiAdvice() {
    if (this.data.adviceLoading) return;
    this.setData({ adviceLoading: true });
    try {
      const res = await merchantDashboardService.fetchDashboardAdvice();
      this.setData({
        adviceLoading: false,
        adviceVisible: true,
        adviceContent: res.content || '',
        adviceSnapshotDate: res.snapshotDate || '',
      });
    } catch (e) {
      this.setData({ adviceLoading: false });
      wx.showToast({
        title: (e.message || '加载失败').slice(0, 24),
        icon: 'none',
        duration: 2800,
      });
    }
  },

  onCloseAdvice() {
    this.setData({ adviceVisible: false });
    wx.nextTick(() => this._redrawChart());
  },

});
