function buildStars(value) {
  const v = Number(value) || 0;
  return [1, 2, 3, 4, 5].map((index) => {
    let state = 'empty';
    if (v >= index) state = 'full';
    else if (v >= index - 0.5) state = 'half';
    return {
      index,
      half: index - 0.5,
      full: index,
      state,
    };
  });
}

Component({
  properties: {
    value: { type: Number, value: 0 },
    readonly: { type: Boolean, value: false },
  },
  data: {
    stars: buildStars(0),
  },
  observers: {
    value(v) {
      this.setData({ stars: buildStars(v) });
    },
  },
  methods: {
    onTapHalf(e) {
      if (this.data.readonly) return;
      const next = Number(e.currentTarget.dataset.value);
      if (!next) return;
      this.triggerEvent('change', { value: next });
    },
  },
});
