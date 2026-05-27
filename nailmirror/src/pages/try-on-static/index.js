const tryOnService = require('../../services/try-on.service');
const styleService = require('../../services/style.service');
const historyService = require('../../services/history.service');
const { pickHandPhoto, resolveBundledPhoto, downloadRemoteHand } = require('../../utils/image');
const { tryOnStore } = require('../../stores/try-on.store');
const { NAIL_SHAPES } = require('../../config/enums');
const featureFlags = require('../../config/feature-flags');
const mockHand = require('../../config/mock-hand');

const WAN_MODEL_STORAGE_KEY = 'tryon_wan_model';

function resolveInitialWanModel() {
  if (!featureFlags.SHOW_WAN_MODEL_PICKER) {
    return featureFlags.DEFAULT_WAN_MODEL || '';
  }
  try {
    const saved = wx.getStorageSync(WAN_MODEL_STORAGE_KEY);
    if (saved) return saved;
  } catch (e) { /* ignore */ }
  if (featureFlags.DEFAULT_WAN_MODEL) return featureFlags.DEFAULT_WAN_MODEL;
  const opts = featureFlags.WAN_MODEL_OPTIONS || [];
  return opts.length ? opts[0].id : '';
}

function wanModelLabel(modelId) {
  const opts = featureFlags.WAN_MODEL_OPTIONS || [];
  const found = opts.find((o) => o.id === modelId);
  return found ? found.label : (modelId || '默认');
}

function wanModelIndexOf(modelId) {
  const opts = featureFlags.WAN_MODEL_OPTIONS || [];
  const idx = opts.findIndex((o) => o.id === modelId);
  return idx >= 0 ? idx : 0;
}

// 流程步骤：shape → (style 仅当未传 styleId) → photo → preview
const STEP_ORDER_FULL  = ['shape', 'style', 'photo', 'preview'];
const STEP_ORDER_SHORT = ['shape', 'photo', 'preview'];

Page({
  data: {
    step: 'shape',
    stepIndex: 0,
    stepLabels: [],
    needPickStyle: false,

    shapes: NAIL_SHAPES,
    selectedShape: '',
    shapeLabel: '',

    photoPath: '',
    photoUploadPath: '',
    useMockHand: false,
    evalHands: [],
    selectedEvalHandId: '',
    mockHandLabel: '',
    styleId: '',
    style: null,
    composedUrl: '',

    // 选款式列表
    styleList: [],
    styleLoading: false,

    // 切换/相邻款式
    altStyles: [],
    composing: false,
    composeProgress: '',

    showWanModelPicker: false,
    wanModelOptions: [],
    wanModelIndex: 0,
    selectedWanModel: '',
    selectedWanModelLabel: '',
    usedWanModel: '',
    usedWanModelLabel: ''
  },

  async onLoad(query) {
    const incomingStyleId = (query && query.styleId) || tryOnStore.currentStyleId || '';
    const needPickStyle = !incomingStyleId;
    const stepLabels = needPickStyle
      ? [
          { key: 'shape',   label: '选甲型' },
          { key: 'style',   label: '选款式' },
          { key: 'photo',   label: '上传照片' },
          { key: 'preview', label: '生成预览' }
        ]
      : [
          { key: 'shape',   label: '选甲型' },
          { key: 'photo',   label: '上传照片' },
          { key: 'preview', label: '生成预览' }
        ];
    const initShape = tryOnStore.currentShape || '';
    const initWanModel = resolveInitialWanModel();
    const wanOpts = featureFlags.WAN_MODEL_OPTIONS || [];

    this.setData({
      needPickStyle,
      stepLabels,
      stepIndex: 0,
      step: 'shape',
      styleId: incomingStyleId,
      selectedShape: initShape,
      shapeLabel: this._labelOfShape(initShape),
      evalHands: featureFlags.USE_MOCK_HAND_PHOTO ? mockHand.evalHands : [],
      selectedEvalHandId: mockHand.DEFAULT_EVAL_ID,
      showWanModelPicker: !!featureFlags.SHOW_WAN_MODEL_PICKER && wanOpts.length > 1,
      wanModelOptions: wanOpts,
      selectedWanModel: initWanModel,
      selectedWanModelLabel: wanModelLabel(initWanModel),
      wanModelIndex: wanModelIndexOf(initWanModel)
    });

    if (incomingStyleId) {
      try {
        const style = await styleService.get(incomingStyleId);
        this.setData({ style });
      } catch (e) {}
    }

    try {
      const r = await styleService.list({ page: 1, pageSize: 8 });
      this.setData({ altStyles: r.items });
    } catch (e) {}
  },

  _labelOfShape(id) {
    const found = NAIL_SHAPES.find(s => s.id === id);
    return found ? found.label : '';
  },

  _orderKeys() {
    return this.data.needPickStyle ? STEP_ORDER_FULL : STEP_ORDER_SHORT;
  },

  _gotoStep(key) {
    const keys = this._orderKeys();
    const idx = keys.indexOf(key);
    if (idx < 0) return;
    this.setData({ step: key, stepIndex: idx });
  },

  async _applyMockHandPhoto(handId) {
    const id = handId || mockHand.DEFAULT_EVAL_ID;
    wx.showLoading({ title: '加载测试手照…', mask: true });
    try {
      if (id === mockHand.LOCAL.id || id === 'local') {
        const uploadPath = await resolveBundledPhoto(mockHand.LOCAL.bundlePath);
        this.setData({
          photoPath: mockHand.LOCAL.displayPath,
          photoUploadPath: uploadPath,
          useMockHand: true,
          selectedEvalHandId: 'local',
          mockHandLabel: mockHand.LOCAL.label
        });
        return;
      }
      const item = (mockHand.evalHands || []).find((h) => h.id === id) || mockHand.evalHands[0];
      if (!item) throw new Error('无评测手照');
      const uploadPath = await downloadRemoteHand(item.handUrl);
      this.setData({
        photoPath: item.handUrl,
        photoUploadPath: uploadPath,
        useMockHand: true,
        selectedEvalHandId: item.id,
        mockHandLabel: item.label
      });
    } catch (e) {
      wx.showToast({ title: e.message || '测试手照加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onSelectEvalHand(e) {
    const id = e.currentTarget.dataset.id;
    if (id === this.data.selectedEvalHandId && this.data.photoPath) return;
    this._applyMockHandPhoto(id);
  },

  _photoForUpload() {
    return this.data.photoUploadPath || this.data.photoPath;
  },

  // ---- Step: 选甲型 ----
  onPickShape(e) {
    const v = e.currentTarget.dataset.v;
    this.setData({ selectedShape: v, shapeLabel: this._labelOfShape(v) });
    tryOnStore.setShape(v);
  },
  onShapeNext() {
    if (!this.data.selectedShape) {
      wx.showToast({ title: '请先选择甲型', icon: 'none' });
      return;
    }
    if (this.data.needPickStyle) {
      this._gotoStep('style');
      this.loadStyleList();
    } else {
      this._gotoStep('photo');
    }
  },

  // ---- Step: 选款式 ----
  async loadStyleList() {
    if (this.data.styleList.length || this.data.styleLoading) return;
    this.setData({ styleLoading: true });
    try {
      const r = await styleService.list({ page: 1, pageSize: 12 });
      this.setData({ styleList: r.items });
    } catch (e) {
      wx.showToast({ title: '款式加载失败', icon: 'none' });
    } finally {
      this.setData({ styleLoading: false });
    }
  },
  async onPickStyle(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ styleId: id });
    tryOnStore.setStyle(id);
    try {
      const style = await styleService.get(id);
      this.setData({ style });
    } catch (e2) {}
  },
  onStyleNext() {
    if (!this.data.styleId) {
      wx.showToast({ title: '请先选择款式', icon: 'none' });
      return;
    }
    this._gotoStep('photo');
  },

  // ---- Step: 上传照片 ----
  async _setPhotoFromPick(mode) {
    try {
      const tempPath = await pickHandPhoto(mode);
      this.setData({
        photoPath: tempPath,
        photoUploadPath: tempPath,
        useMockHand: false,
        selectedEvalHandId: '',
        mockHandLabel: ''
      });
    } catch (e) {
      const msg = (e && e.message) || (e && e.errMsg) || '';
      if (msg.indexOf('cancel') > -1 || msg.indexOf('取消') > -1) return;
      wx.showToast({
        title: msg.length > 24 ? msg.slice(0, 24) + '…' : (msg || '无法打开相册'),
        icon: 'none',
        duration: 3000
      });
    }
  },
  onPickFromAlbum() {
    this._setPhotoFromPick('album');
  },
  onPickFromCamera() {
    this._setPhotoFromPick('camera');
  },
  onClearPhoto() {
    this.setData({
      photoPath: '',
      photoUploadPath: '',
      useMockHand: false,
      selectedEvalHandId: '',
      mockHandLabel: ''
    });
  },
  onUseMockHand() {
    this._applyMockHandPhoto(this.data.selectedEvalHandId || mockHand.DEFAULT_EVAL_ID);
  },

  onWanModelPick(e) {
    const idx = Number(e.detail.value);
    const opt = (this.data.wanModelOptions || [])[idx];
    if (!opt) return;
    this.setData({
      wanModelIndex: idx,
      selectedWanModel: opt.id,
      selectedWanModelLabel: opt.label
    });
    try {
      wx.setStorageSync(WAN_MODEL_STORAGE_KEY, opt.id);
    } catch (err) { /* ignore */ }
  },

  _tryonOpts() {
    return this.data.selectedWanModel ? { wanModel: this.data.selectedWanModel } : {};
  },

  async onCompose() {
    if (!this.data.photoPath) {
      wx.showToast({ title: '请先上传照片', icon: 'none' });
      return;
    }
    if (!this.data.styleId) {
      wx.showToast({ title: '请先选择款式', icon: 'none' });
      return;
    }
    this._gotoStep('preview');
    this.setData({ composing: true, composeProgress: '分析款式与指甲位置…' });
    try {
      const r = await tryOnService.startStatic(
        this._photoForUpload(),
        this.data.styleId,
        this.data.selectedShape,
        this._tryonOpts()
      );
      this.setData({
        composedUrl: r.composedUrl,
        composeProgress: '',
        usedWanModel: r.wanModel || this.data.selectedWanModel,
        usedWanModelLabel: wanModelLabel(r.wanModel || this.data.selectedWanModel)
      });
    } catch (e) {
      wx.showToast({ title: e.message || '合成失败', icon: 'none' });
    } finally {
      this.setData({ composing: false, composeProgress: '' });
    }
  },

  // ---- 通用：返回上一步 ----
  onPrevStep() {
    const keys = this._orderKeys();
    const idx = keys.indexOf(this.data.step);
    if (idx <= 0) return;
    const prev = keys[idx - 1];
    if (this.data.step === 'preview') {
      this.setData({ composedUrl: '', usedWanModel: '', usedWanModelLabel: '' });
    }
    if (this.data.step === 'photo') {
      this.setData({
        photoPath: '',
        photoUploadPath: '',
        useMockHand: false,
        selectedEvalHandId: '',
        mockHandLabel: ''
      });
    }
    this._gotoStep(prev);
  },

  // ---- Step preview：换款 / 出片 ----
  async onSwitchStyle(e) {
    const id = e.currentTarget.dataset.id;
    if (id === this.data.styleId) return;
    this.setData({ styleId: id });
    tryOnStore.setStyle(id);
    if (this.data.photoPath) {
      this.setData({ composing: true, composeProgress: '换款合成中…' });
      try {
        const r = await tryOnService.startStatic(
          this._photoForUpload(),
          id,
          this.data.selectedShape,
          this._tryonOpts()
        );
        this.setData({
          composedUrl: r.composedUrl,
          usedWanModel: r.wanModel || this.data.selectedWanModel,
          usedWanModelLabel: wanModelLabel(r.wanModel || this.data.selectedWanModel)
        });
      } finally {
        this.setData({ composing: false, composeProgress: '' });
      }
    }
    try {
      const style = await styleService.get(id);
      this.setData({ style });
    } catch (e) {}
  },
  async onSaveAndOutput() {
    if (!this.data.composedUrl) {
      wx.showToast({ title: '请先合成预览', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '生成 2K 中…' });
    try {
      const hd = await tryOnService.generateHD({
        sessionId: 'static',
        styleId: this.data.styleId,
        sourceUrl: this.data.composedUrl
      });
      await historyService.append({
        userOpenid: 'me',
        styleId: this.data.styleId,
        nailShape: this.data.selectedShape,
        mode: 'static',
        thumbUrl: this.data.composedUrl,
        hdUrl: hd.hdUrl
      });
      wx.hideLoading();
      require('../../utils/hd-output-nav').navigateTo(this.data.styleId, hd.hdUrl);
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '导出失败', icon: 'none' });
    }
  }
});
