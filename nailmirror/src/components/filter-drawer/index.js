const { NAIL_STYLES, NAIL_MATERIALS, NAIL_SHAPES } = require('../../config/enums');
const {
  COLOR_FAMILIES,
  DESIGNS,
  SHAPES,
  STYLES
} = require('../../config/tag-vocabulary');

function toOptions(list) {
  return list.map((label) => ({ id: label, label: label }));
}

Component({
  properties: {
    visible: { type: Boolean, value: false },
    useReal: { type: Boolean, value: false },
    initial: { type: Object, value: null }
  },
  data: {
    styles: NAIL_STYLES,
    materials: NAIL_MATERIALS,
    shapes: NAIL_SHAPES,
    colors: toOptions(COLOR_FAMILIES),
    designs: toOptions(DESIGNS),
    shapeLabels: toOptions(SHAPES),
    styleLabels: toOptions(STYLES),
    selStyles: [],
    selMaterials: [],
    selShapes: [],
    selColors: [],
    selDesigns: [],
    selStyleLabels: [],
    selShapeLabels: []
  },
  observers: {
    'visible, initial, useReal': function (visible, initial) {
      if (!visible || !initial) return;
      if (this.properties.useReal) {
        this.setData({
          selColors: (initial.colors || []).slice(),
          selDesigns: (initial.designs || []).slice(),
          selStyleLabels: (initial.styleLabels || []).slice(),
          selShapeLabels: (initial.shapeLabels || []).slice()
        });
      } else {
        this.setData({
          selStyles: (initial.styleTags || []).slice(),
          selMaterials: (initial.materialTags || []).slice(),
          selShapes: (initial.shapeTags || []).slice()
        });
      }
    }
  },
  methods: {
    _toggle(arr, v) {
      const next = arr.slice();
      const i = next.indexOf(v);
      if (i > -1) next.splice(i, 1);
      else next.push(v);
      return next;
    },
    onStyleTap(e) {
      const v = e.currentTarget.dataset.v;
      this.setData({ selStyles: this._toggle(this.data.selStyles, v) });
    },
    onMaterialTap(e) {
      const v = e.currentTarget.dataset.v;
      this.setData({ selMaterials: this._toggle(this.data.selMaterials, v) });
    },
    onShapeTap(e) {
      const v = e.currentTarget.dataset.v;
      this.setData({ selShapes: this._toggle(this.data.selShapes, v) });
    },
    onColorTap(e) {
      const v = e.currentTarget.dataset.v;
      this.setData({ selColors: this._toggle(this.data.selColors, v) });
    },
    onDesignTap(e) {
      const v = e.currentTarget.dataset.v;
      this.setData({ selDesigns: this._toggle(this.data.selDesigns, v) });
    },
    onStyleLabelTap(e) {
      const v = e.currentTarget.dataset.v;
      this.setData({ selStyleLabels: this._toggle(this.data.selStyleLabels, v) });
    },
    onShapeLabelTap(e) {
      const v = e.currentTarget.dataset.v;
      this.setData({ selShapeLabels: this._toggle(this.data.selShapeLabels, v) });
    },
    onReset() {
      if (this.properties.useReal) {
        this.setData({
          selColors: [],
          selDesigns: [],
          selStyleLabels: [],
          selShapeLabels: []
        });
      } else {
        this.setData({ selStyles: [], selMaterials: [], selShapes: [] });
      }
    },
    onConfirm() {
      if (this.properties.useReal) {
        this.triggerEvent('change', {
          colors: this.data.selColors,
          designs: this.data.selDesigns,
          styleLabels: this.data.selStyleLabels,
          shapeLabels: this.data.selShapeLabels
        });
      } else {
        this.triggerEvent('change', {
          styleTags: this.data.selStyles,
          materialTags: this.data.selMaterials,
          shapeTags: this.data.selShapes
        });
      }
      this.triggerEvent('close');
    },
    onClose() {
      this.triggerEvent('close');
    }
  }
});
