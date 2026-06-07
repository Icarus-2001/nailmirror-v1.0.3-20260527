const { userStore } = require('../../stores/user.store');
const merchantDashboardService = require('../../services/merchant-dashboard.service');

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

function formatUpdatedAt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.getFullYear() + '-'
    + String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0') + ' '
    + String(d.getHours()).padStart(2, '0') + ':'
    + String(d.getMinutes()).padStart(2, '0');
}

function formatWow(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return '0%';
  if (n > 0) return '+' + n + '%';
  return n + '%';
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
    dataHealth: {},
    updatedAtText: '',
    trendsHot: [],
    trendsCold: [],
    tagItems: [],
    emptyHint: '',
  },

  _raw: null,

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
      this.setData({
        loading: false,
        dates: (res.overview && res.overview.dates) || [],
        styleOptions: (res.styles || []).map((s) => ({
          id: s.id,
          title: s.title,
          heatNow: s.heatNow,
          checked: selectedIds.indexOf(s.id) >= 0,
        })),
        selectedIds: selectedIds.slice(0, MAX_SELECTED),
        dataHealth: res.dataHealth || {},
        updatedAtText: formatUpdatedAt(res.updatedAt),
        trendsHot: ((res.trends && res.trends.hot) || []).map((item) => Object.assign({}, item, {
          wowText: formatWow(item.wowHeat),
        })),
        trendsCold: ((res.trends && res.trends.cold) || []).map((item) => Object.assign({}, item, {
          wowText: formatWow(item.wowHeat),
        })),
        emptyHint: (res.dataHealth && res.dataHealth.message) || '',
        tagItems: this._tagItems(res, 'color'),
      });
      this._refreshChart();
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: (e.message || '加载失败').slice(0, 20), icon: 'none' });
    }
  },

  _tagItems(res, tab) {
    const analysis = (res && res.tagAnalysis) || {};
    return (analysis[tab] || []).map((item) => ({
      label: item.tag,
      value: item.heatSum,
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
    this.setData({
      activeTagTab: key,
      tagItems: this._tagItems(this._raw, key),
    });
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
    this.setData({ selectedIds: selected, styleOptions });
    this._refreshChart();
  },

});
