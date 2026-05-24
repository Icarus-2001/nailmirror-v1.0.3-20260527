const styleService = require('../../services/style.service');
const featureFlags = require('../../config/feature-flags');
const { NAIL_STYLES } = require('../../config/enums');
const { PAGE_SIZE } = require('../../config/constants');

Page({
  data: {
    styleTabs: [{ id: '', label: '全部' }],
    colorTabs: [{ id: '', label: '全部颜色' }],
    currentStyle: '',
    currentColor: '',
    keyword: '',
    items: [],
    page: 1,
    hasMore: true,
    loading: false,
    fallback: false,
    drawerVisible: false,
    filters: { styleTags: [], materialTags: [], shapeTags: [] },
    useReal: false
  },
  onLoad() {
    const useReal = featureFlags.USE_REAL_STYLES;
    let styleTabs = [{ id: '', label: '全部' }].concat(NAIL_STYLES);
    let colorTabs = [{ id: '', label: '全部颜色' }];
    if (useReal) {
      const cats = styleService.getCategories();
      styleTabs = [{ id: '', label: '全部' }].concat(
        cats.styles.map((s) => ({ id: s, label: s, type: 'styleLabel' }))
      );
      colorTabs = [{ id: '', label: '全部颜色' }].concat(
        cats.colors.map((c) => ({ id: c, label: c, type: 'color' }))
      );
    }
    this.setData({ useReal, styleTabs, colorTabs });
    this.loadList(true);
  },
  async loadList(reset) {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const page = reset ? 1 : this.data.page + 1;
      const filters = Object.assign({}, this.data.filters);
      if (this.data.useReal) {
        if (this.data.currentStyle) filters.styleLabel = this.data.currentStyle;
        if (this.data.currentColor) filters.color = this.data.currentColor;
      } else if (this.data.currentStyle) {
        filters.styleTags = [this.data.currentStyle];
      }
      let resp;
      if (this.data.keyword) {
        resp = await styleService.search({ keyword: this.data.keyword, filters });
        this.setData({
          items: resp.items,
          fallback: !!resp.fallback,
          hasMore: false,
          page: 1
        });
      } else {
        resp = await styleService.list(Object.assign({ page, pageSize: PAGE_SIZE }, filters));
        const merged = reset ? resp.items : this.data.items.concat(resp.items);
        this.setData({
          items: merged,
          page,
          hasMore: merged.length < resp.total,
          fallback: false
        });
      }
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
  onTabTap(e) {
    this.setData({ currentStyle: e.currentTarget.dataset.id });
    this.loadList(true);
  },
  onColorTap(e) {
    this.setData({ currentColor: e.currentTarget.dataset.id });
    this.loadList(true);
  },
  onKeyword(e) { this.setData({ keyword: e.detail.value }); },
  onSearch() { this.loadList(true); },
  onOpenFilter() { this.setData({ drawerVisible: true }); },
  onDrawerClose() { this.setData({ drawerVisible: false }); },
  onFilterChange(e) {
    this.setData({ filters: e.detail, drawerVisible: false });
    this.loadList(true);
  },
  onReachBottom() {
    if (this.data.hasMore && !this.data.keyword) this.loadList(false);
  }
});
