const styleService = require('../../services/style.service');
const featureFlags = require('../../config/feature-flags');
const { PAGE_SIZE } = require('../../config/constants');

Page({
  data: {
    keyword: '',
    items: [],
    page: 1,
    hasMore: true,
    loading: false,
    fallback: false,
    drawerVisible: false,
    filters: { styleTags: [], materialTags: [], shapeTags: [] },
    drawerFilters: { colors: [], designs: [], styleLabels: [], shapeLabels: [] },
    useReal: false
  },
  onLoad(query) {
    const keyword = query && query.keyword ? decodeURIComponent(query.keyword) : '';
    const useReal = featureFlags.USE_REAL_STYLES;
    const drawerFilters = useReal
      ? { colors: [], designs: [], styleLabels: [], shapeLabels: [] }
      : { styleTags: [], materialTags: [], shapeTags: [] };
    this.setData({ useReal, drawerFilters, filters: drawerFilters, keyword });
    this.loadList(true);
  },
  async loadList(reset) {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const page = reset ? 1 : this.data.page + 1;
      const filters = Object.assign({}, this.data.drawerFilters);
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
  onKeyword(e) { this.setData({ keyword: e.detail.value }); },
  onSearch() { this.loadList(true); },
  onOpenFilter() { this.setData({ drawerVisible: true }); },
  onDrawerClose() { this.setData({ drawerVisible: false }); },
  onFilterChange(e) {
    this.setData({ drawerFilters: e.detail, drawerVisible: false });
    this.loadList(true);
  },
  onReachBottom() {
    if (this.data.hasMore && !this.data.keyword) this.loadList(false);
  }
});
