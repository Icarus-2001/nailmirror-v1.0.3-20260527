const { NAIL_SHAPES } = require('../../config/enums');
const { tryOnStore } = require('../../stores/try-on.store');

Component({
  properties: {
    value: { type: String, value: '' }
  },
  data: {
    shapes: NAIL_SHAPES,
    selected: ''
  },
  observers: {
    'value': function (v) { this.setData({ selected: v || tryOnStore.currentShape }); }
  },
  methods: {
    onPick(e) {
      const v = e.currentTarget.dataset.v;
      this.setData({ selected: v });
      tryOnStore.setShape(v);
      this.triggerEvent('change', { value: v });
    }
  }
});
