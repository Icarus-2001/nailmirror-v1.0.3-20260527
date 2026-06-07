Component({
  properties: {
    items: { type: Array, value: [] },
  },

  data: {
    normalized: [],
    maxVal: 1,
  },

  observers: {
    items(items) {
      const list = (items || []).slice(0, 8);
      const maxVal = Math.max(...list.map((i) => Number(i.value) || 0), 1);
      const normalized = list.map((item) => ({
        label: item.label || '未分类',
        value: Number(item.value) || 0,
        pct: Math.round(((Number(item.value) || 0) / maxVal) * 100),
      }));
      this.setData({ normalized, maxVal });
    },
  },
});
