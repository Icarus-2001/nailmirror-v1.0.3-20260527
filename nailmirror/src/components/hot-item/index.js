Component({
  properties: {
    rank: { type: Number, value: 1 },
    word: { type: String, value: '' },
    platform: { type: String, value: '' },
    heat: { type: Number, value: 0 }
  },
  methods: {
    onTap() { this.triggerEvent('tap', { word: this.data.word }); }
  }
});
