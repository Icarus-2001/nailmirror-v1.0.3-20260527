const { NAIL_STYLES, NAIL_MATERIALS, NAIL_SHAPES } = require('../../config/enums');

Component({
  properties: {
    visible: { type: Boolean, value: false },
    initial: { type: Object, value: null }
  },
  data: {
    styles: NAIL_STYLES,
    materials: NAIL_MATERIALS,
    shapes: NAIL_SHAPES,
    selStyles: [],
    selMaterials: [],
    selShapes: []
  },
  observers: {
    'visible, initial': function (v, init) {
      if (v && init) {
        this.setData({
          selStyles: (init.styleTags || []).slice(),
          selMaterials: (init.materialTags || []).slice(),
          selShapes: (init.shapeTags || []).slice()
        });
      }
    }
  },
  methods: {
    _toggle(arr, v) {
      const i = arr.indexOf(v);
      if (i > -1) { arr.splice(i, 1); } else { arr.push(v); }
      return arr.slice();
    },
    onStyleTap(e) { const v = e.currentTarget.dataset.v; this.setData({ selStyles: this._toggle(this.data.selStyles.slice(), v) }); },
    onMaterialTap(e) { const v = e.currentTarget.dataset.v; this.setData({ selMaterials: this._toggle(this.data.selMaterials.slice(), v) }); },
    onShapeTap(e) { const v = e.currentTarget.dataset.v; this.setData({ selShapes: this._toggle(this.data.selShapes.slice(), v) }); },
    onReset() { this.setData({ selStyles: [], selMaterials: [], selShapes: [] }); },
    onConfirm() {
      this.triggerEvent('change', {
        styleTags: this.data.selStyles,
        materialTags: this.data.selMaterials,
        shapeTags: this.data.selShapes
      });
      this.triggerEvent('close');
    },
    onClose() { this.triggerEvent('close'); }
  }
});
