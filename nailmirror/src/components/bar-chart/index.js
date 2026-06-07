Component({
  properties: {
    items: { type: Array, value: [] },
    valueSuffix: { type: String, value: '款' },
    showSub: { type: Boolean, value: true },
  },

  data: {
    normalized: [],
    maxVal: 1,
  },

  observers: {
    items(items) {
      const list = (items || []).slice(0, 8);
      const maxVal = list.length
        ? Math.max(...list.map((i) => Number(i.value) || 0), 1)
        : 1;
      const normalized = list.map((item, idx) => ({
        key: (item.label || '未分类') + '_' + idx,
        label: item.label || '未分类',
        value: Number(item.value) || 0,
        sub: Number(item.sub) || 0,
        pct: Math.round(((Number(item.value) || 0) / maxVal) * 100),
      }));
      this.setData({ normalized, maxVal });
    },
  },
});
