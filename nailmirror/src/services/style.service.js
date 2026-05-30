// StyleService: list / get / search
const { mockDelay, makeError } = require('../utils/request');
const { PAGE_SIZE } = require('../config/constants');
const ERR = require('../config/error-codes');
const featureFlags = require('../config/feature-flags');
const mockStyles = require('../mock/styles');
const realStyles = require('../mock/styles.real');

function getAllStyles() {
  if (featureFlags.USE_REAL_STYLES) return realStyles.filter((s) => s.isActive !== false);
  return mockStyles;
}

function matchListFilter(values, fieldValue) {
  if (!values || !values.length) return true;
  return values.indexOf(fieldValue) > -1;
}

function matchFilters(item, filters) {
  if (!filters) return true;
  const {
    styleTags, materialTags, shapeTags,
    color, design, styleLabel, shapeLabel,
    colors, designs, styleLabels, shapeLabels
  } = filters;
  if (styleTags && styleTags.length && !styleTags.some((t) => (item.styleTags || []).indexOf(t) > -1)) return false;
  if (materialTags && materialTags.length && !materialTags.some((t) => (item.materialTags || []).indexOf(t) > -1)) return false;
  if (shapeTags && shapeTags.length && !shapeTags.some((t) => (item.shapeTags || []).indexOf(t) > -1)) return false;
  if (!matchListFilter(colors, item.color)) return false;
  if (!matchListFilter(designs, item.design)) return false;
  if (!matchListFilter(styleLabels, item.styleLabel)) return false;
  if (!matchListFilter(shapeLabels, item.shapeLabel)) return false;
  if (color && item.color !== color) return false;
  if (design && item.design !== design) return false;
  if (styleLabel && item.styleLabel !== styleLabel) return false;
  if (shapeLabel && item.shapeLabel !== shapeLabel) return false;
  return true;
}

async function list(filters) {
  const { page = 1, pageSize = PAGE_SIZE } = filters || {};
  return mockDelay(() => {
    const allStyles = getAllStyles();
    const filtered = allStyles.filter((s) => matchFilters(s, filters));
    const sorted = filtered.slice().sort((a, b) => (b.heat || 0) - (a.heat || 0));
    const start = (page - 1) * pageSize;
    return {
      items: sorted.slice(start, start + pageSize),
      total: sorted.length,
      page
    };
  }, 120, 200);
}

async function get(id) {
  return mockDelay(() => {
    const item = getAllStyles().find((s) => s.id === id);
    if (!item) throw makeError(ERR.NOT_FOUND, '款式不存在');
    return item;
  }, 80, 150);
}

async function search(opts) {
  const { keyword = '', filters } = opts || {};
  return mockDelay(() => {
    const kw = keyword.trim().toLowerCase();
    let items = getAllStyles().filter((s) => matchFilters(s, filters));
    if (kw) {
      items = items.filter(
        (s) =>
          (s.title || '').toLowerCase().indexOf(kw) > -1 ||
          (s.brief || '').toLowerCase().indexOf(kw) > -1 ||
          (s.color || '').indexOf(kw) > -1 ||
          (s.design || '').indexOf(kw) > -1 ||
          (s.styleLabel || '').indexOf(kw) > -1 ||
          (s.styleTags || []).some((t) => t.indexOf(kw) > -1)
      );
    }
    if (items.length === 0) {
      items = getAllStyles().slice().sort((a, b) => b.heat - a.heat).slice(0, 10);
      return { items, fallback: true };
    }
    return { items, fallback: false };
  }, 150, 250);
}

function getCategories() {
  const all = getAllStyles();
  const styles = [];
  const colors = [];
  const designs = [];
  const shapes = [];
  const seen = { s: {}, c: {}, d: {}, h: {} };
  all.forEach((item) => {
    if (item.styleLabel && !seen.s[item.styleLabel]) { seen.s[item.styleLabel] = 1; styles.push(item.styleLabel); }
    if (item.color && !seen.c[item.color]) { seen.c[item.color] = 1; colors.push(item.color); }
    if (item.design && !seen.d[item.design]) { seen.d[item.design] = 1; designs.push(item.design); }
    if (item.shapeLabel && !seen.h[item.shapeLabel]) { seen.h[item.shapeLabel] = 1; shapes.push(item.shapeLabel); }
  });
  return { styles, colors, designs, shapes };
}

module.exports = { list, get, search, getCategories, getAllStyles };
