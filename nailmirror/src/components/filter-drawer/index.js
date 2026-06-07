const {
  NAIL_STYLES,
  NAIL_MATERIALS,
  NAIL_SHAPES,
  COLOR_FAMILIES,
  DESIGNS,
  NAIL_SHAPE_LABELS,
  NAIL_STYLE_LABELS
} = require('../../config/enums');

function toOptions(list) {
  return list.map((label) => ({ id: label, label: label }));
}

const SOURCE_OPTIONS = [
  { id: 'platform', label: '平台特供' },
  { id: 'merchant-upload', label: '来自商家' },
  { id: 'xhs-hot', label: '全网热款' }
];

const SORT_OPTIONS = [
  { id: 'heat-desc', sortBy: 'heat', sortOrder: 'desc', label: '热度优先' },
  { id: 'createdAt-desc', sortBy: 'createdAt', sortOrder: 'desc', label: '最新上传' },
  { id: 'createdAt-asc', sortBy: 'createdAt', sortOrder: 'asc', label: '最早上传' }
];

const DEFAULT_SORT_KEY = 'heat-desc';

function sortKeyFromInitial(initial) {
  if (!initial || !initial.sortBy) return DEFAULT_SORT_KEY;
  const order = initial.sortOrder || 'desc';
  const key = initial.sortBy + '-' + order;
  return SORT_OPTIONS.some((o) => o.id === key) ? key : DEFAULT_SORT_KEY;
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
    shapeLabels: toOptions(NAIL_SHAPE_LABELS),
    styleLabels: toOptions(NAIL_STYLE_LABELS),
    sourceOptions: SOURCE_OPTIONS,
    sortOptions: SORT_OPTIONS,
    selStyles: [],
    selMaterials: [],
    selShapes: [],
    selColors: [],
    selDesigns: [],
    selStyleLabels: [],
    selShapeLabels: [],
    selSources: [],
    sortKey: DEFAULT_SORT_KEY
  },
  observers: {
    'visible, initial, useReal': function (visible, initial) {
      if (!visible || !initial) return;
      if (this.properties.useReal) {
        this.setData({
          selColors: (initial.colors || []).slice(),
          selDesigns: (initial.designs || []).slice(),
          selStyleLabels: (initial.styleLabels || []).slice(),
          selShapeLabels: (initial.shapeLabels || []).slice(),
          selSources: (initial.styleSources || []).slice(),
          sortKey: sortKeyFromInitial(initial)
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
    onSourceTap(e) {
      const v = e.currentTarget.dataset.v;
      this.setData({ selSources: this._toggle(this.data.selSources, v) });
    },
    onSortTap(e) {
      const v = e.currentTarget.dataset.v;
      if (v) this.setData({ sortKey: v });
    },
    onReset() {
      if (this.properties.useReal) {
        this.setData({
          selColors: [],
          selDesigns: [],
          selStyleLabels: [],
          selShapeLabels: [],
          selSources: [],
          sortKey: DEFAULT_SORT_KEY
        });
      } else {
        this.setData({ selStyles: [], selMaterials: [], selShapes: [] });
      }
    },
    onConfirm() {
      if (this.properties.useReal) {
        const sortOpt = SORT_OPTIONS.find((o) => o.id === this.data.sortKey) || SORT_OPTIONS[0];
        this.triggerEvent('change', {
          colors: this.data.selColors,
          designs: this.data.selDesigns,
          styleLabels: this.data.selStyleLabels,
          shapeLabels: this.data.selShapeLabels,
          styleSources: this.data.selSources,
          sortBy: sortOpt.sortBy,
          sortOrder: sortOpt.sortOrder
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
