Component({
  properties: {
    label: { type: String, value: '' },
    value: { type: String, value: '' },
    selected: { type: Boolean, value: false },
    removable: { type: Boolean, value: false }
  },
  methods: {
    onTap() { this.triggerEvent('tap', { value: this.data.value, selected: !this.data.selected }); },
    onRemove(e) { if (e && e.stopPropagation) e.stopPropagation(); this.triggerEvent('remove', { value: this.data.value }); }
  }
});
