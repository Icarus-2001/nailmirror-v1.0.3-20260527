const tryOnService = require('../../services/try-on.service');
const styleService = require('../../services/style.service');
const historyService = require('../../services/history.service');
const cloudAdapter = require('../../services/adapters/tryon-cloud-adapter');
const cloudUtil = require('../../utils/cloud');
const { userStore } = require('../../stores/user.store');
const { pickHandPhoto, resolveBundledPhoto, downloadRemoteHand } = require('../../utils/image');
const { tryOnStore } = require('../../stores/try-on.store');
const { NAIL_SHAPES, NAIL_SHAPE_GROUPS } = require('../../config/enums');

function buildShapeGroups() {
  const map = {};
  NAIL_SHAPES.forEach(s => { map[s.id] = s; });
  return NAIL_SHAPE_GROUPS.map(g => ({
    groupLabel: g.groupLabel,
    shapes: g.ids.map(id => map[id]).filter(Boolean)
  }));
}
const featureFlags = require('../../config/feature-flags');
const mockHand = require('../../config/mock-hand');
const composeWaiting = require('../../utils/compose-waiting');
const { BRAND_LOGO } = require('../../config/constants');
const { ESTIMATE_COMPOSE_SEC } = require('../../config/tryon-strategy');
const ratingService = require('../../services/rating.service');

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

// 首页入口：shape → style → photo → preview（四步）
// 商详带 styleId：shape → photo → preview（三步，款式已定）
const STEP_ORDER_FULL = ['shape', 'style', 'photo', 'preview'];
const STEP_ORDER_SHORT = ['shape', 'photo', 'preview'];
const STEP_LABELS_FULL = [
  { key: 'shape', label: '选甲型' },
  { key: 'style', label: '选款式' },
  { key: 'photo', label: '上传照片' },
  { key: 'preview', label: '生成预览' }
];
const STEP_LABELS_SHORT = [
  { key: 'shape', label: '选甲型' },
  { key: 'photo', label: '上传照片' },
  { key: 'preview', label: '生成预览' }
];

Page({
  data: {
    step: 'shape',
    stepIndex: 0,
    stepLabels: [],
    needPickStyle: true,

    shapeGroups: buildShapeGroups(),
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
    composeWaitSec: 0,
    composeWaitTotal: ESTIMATE_COMPOSE_SEC,
    composeWaitPercent: 0,
    brandLogo: BRAND_LOGO,

    showWanModelPicker: false,
    wanModelOptions: [],
    wanModelIndex: 0,
    selectedWanModel: '',
    selectedWanModelLabel: '',
    usedWanModel: '',
    usedWanModelLabel: '',
    tryonEffectDraft: 0,
    nailQualityDraft: 0,
    tryonEffectRatingText: '未评分',
    nailQualityRatingText: '未评分',
    ratingsLocked: false,
    canSubmitRatings: false,
    canRateStyle: false
  },

  async onLoad(query) {
    // 仅 URL styleId 决定三步/四步；勿读 tryOnStore（避免首页误走商详短流程）
    const incomingStyleId = (query && query.styleId) || '';
    const needPickStyle = !incomingStyleId;
    const initShape = tryOnStore.currentShape || '';
    const initWanModel = resolveInitialWanModel();
    const wanOpts = featureFlags.WAN_MODEL_OPTIONS || [];

    // 每次进入生成一个会话 ID，用于漏斗分析
    this._sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    this._logEvent('tryon_enter', { shortFlow: !needPickStyle });

    this.setData({
      needPickStyle,
      stepLabels: needPickStyle ? STEP_LABELS_FULL : STEP_LABELS_SHORT,
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
      tryOnStore.setStyle(incomingStyleId);
      try {
        const style = await styleService.get(incomingStyleId);
        this.setData({ style });
        this._applyStyleRatingState(style);
      } catch (e) {}
    }

    try {
      const r = await styleService.list({ page: 1, pageSize: 8 });
      this.setData({ altStyles: r.items });
    } catch (e) {}
  },

  _labelOfShape(id) {
    if (!id) return '';
    const found = NAIL_SHAPES.find(s => s.id === id);
    if (found) return found.label;
    // 兼容旧 id：通过 SHAPE_ID_TO_LABEL 映射
    const { SHAPE_ID_TO_LABEL } = require('../../config/label-maps');
    return SHAPE_ID_TO_LABEL[id] || id;
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

  _canRateStyle(style) {
    if (!style || !style.id) return false;
    if (style.styleSource === 'custom-upload') return false;
    return String(style.id).indexOf('custom-') !== 0;
  },

  _ratingTextFor(value) {
    return value > 0 ? (ratingService.formatScoreText(value) + ' / 5') : '未评分';
  },

  _syncRatingSubmitState(overrides) {
    const tryonEffectDraft = overrides.tryonEffectDraft != null
      ? overrides.tryonEffectDraft
      : this.data.tryonEffectDraft;
    const nailQualityDraft = overrides.nailQualityDraft != null
      ? overrides.nailQualityDraft
      : this.data.nailQualityDraft;
    const ratingsLocked = overrides.ratingsLocked != null
      ? overrides.ratingsLocked
      : this.data.ratingsLocked;
    this.setData(Object.assign({}, overrides, {
      tryonEffectRatingText: this._ratingTextFor(tryonEffectDraft),
      nailQualityRatingText: this._ratingTextFor(nailQualityDraft),
      canSubmitRatings: (
        !ratingsLocked
        && tryonEffectDraft > 0
        && nailQualityDraft > 0
      ),
    }));
  },

  _applyStyleRatingState(style) {
    const canRate = this._canRateStyle(style);
    if (!canRate || !style || !style.id) {
      this.setData({
        canRateStyle: false,
        tryonEffectDraft: 0,
        nailQualityDraft: 0,
        ratingsLocked: false,
        canSubmitRatings: false,
        tryonEffectRatingText: '未评分',
        nailQualityRatingText: '未评分',
      });
      return;
    }
    const locked = ratingService.hasAllCommittedRatings(style.id);
    const tryonRecord = ratingService.getUserRating(style.id, ratingService.RATING_TYPE_TRYON);
    const qualityRecord = ratingService.getUserRating(style.id, ratingService.RATING_TYPE_QUALITY);
    const tryonEffectDraft = locked && tryonRecord ? tryonRecord.rating : 0;
    const nailQualityDraft = locked && qualityRecord ? qualityRecord.rating : 0;
    this.setData({ canRateStyle: true, ratingsLocked: locked });
    this._syncRatingSubmitState({ tryonEffectDraft, nailQualityDraft, ratingsLocked: locked });
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
    this._logEvent('shape_confirmed', { shape: this.data.selectedShape });
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
      const r = await styleService.list({ page: 1, pageSize: styleService.getAllStyles().length });
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
      this._applyStyleRatingState(style);
    } catch (e2) {
      this.setData({ style: null });
      this._applyStyleRatingState(null);
    }
  },
  onStyleNext() {
    if (!this.data.styleId) {
      wx.showToast({ title: '请先选择款式', icon: 'none' });
      return;
    }
    this._logEvent('style_confirmed', { styleId: this.data.styleId });
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
    const opts = this.data.selectedWanModel ? { wanModel: this.data.selectedWanModel } : {};
    if (this.data.style && this.data.style.styleSource === 'custom-upload') {
      opts.customStyle = this.data.style;
    }
    return opts;
  },

  async onUploadCustomStyle() {
    if (!cloudUtil.isCloudReady()) {
      wx.showToast({ title: '云开发未就绪，无法上传参考图', icon: 'none' });
      return;
    }
    try {
      const tempPath = await pickHandPhoto('album');
      wx.showLoading({ title: '上传参考图…', mask: true });
      const fileID = await cloudAdapter.uploadStyleRef(tempPath);
      const id = 'custom-' + Date.now();
      const customStyle = {
        id,
        title: '自定义参考图',
        styleSource: 'custom-upload',
        styleImageFileID: fileID,
        coverUrl: tempPath
      };
      this.setData({
        styleId: id,
        style: customStyle,
        tryonEffectDraft: 0,
        nailQualityDraft: 0,
        tryonEffectRatingText: '未评分',
        nailQualityRatingText: '未评分',
        ratingsLocked: false,
        canSubmitRatings: false,
        canRateStyle: false,
      });
      tryOnStore.setStyle(id);
      wx.showToast({ title: '已选择参考图', icon: 'success' });
    } catch (e) {
      const msg = (e && e.message) || (e && e.errMsg) || '';
      if (msg.indexOf('cancel') > -1 || msg.indexOf('取消') > -1) return;
      wx.showToast({
        title: msg.length > 20 ? msg.slice(0, 20) + '…' : (msg || '上传失败'),
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
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
    this._logEvent('compose_start');
    composeWaiting.start(this);
    try {
      const r = await tryOnService.startStatic(
        this._photoForUpload(),
        this.data.styleId,
        this.data.selectedShape,
        this._tryonOpts()
      );
      this.setData({
        composedUrl: r.composedUrl,
        usedWanModel: r.wanModel || this.data.selectedWanModel,
        usedWanModelLabel: wanModelLabel(r.wanModel || this.data.selectedWanModel)
      });
      this._applyStyleRatingState(this.data.style);
      this._logEvent('compose_success');
      this._logTryOn(this.data.styleId);
    } catch (e) {
      this._logEvent('compose_fail', { error: (e && e.message) || String(e) });
      wx.showToast({ title: e.message || '合成失败', icon: 'none' });
    } finally {
      composeWaiting.stop(this);
    }
  },

  onUnload() {
    composeWaiting.stop(this);
  },

  onChosenStyleTap() {
    if (!this.data.needPickStyle) return;
    this._gotoStep('style');
    this.loadStyleList();
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
    const alt = (this.data.altStyles || []).find((s) => s.id === id);
    const name = (alt && alt.title) || '该款式';
    const res = await wx.showModal({
      title: '换个款式试试',
      content: '确定换用「' + name + '」重新合成试戴效果？',
      cancelText: '取消',
      confirmText: '确定换款'
    });
    if (!res.confirm) return;
    await this._doSwitchStyle(id);
  },

  async _doSwitchStyle(id) {
    if (this.data.photoPath) {
      composeWaiting.start(this, '换款合成中，请稍候…');
      try {
        const r = await tryOnService.startStatic(
          this._photoForUpload(),
          id,
          this.data.selectedShape,
          this._tryonOpts()
        );
        this.setData({
          styleId: id,
          composedUrl: r.composedUrl,
          usedWanModel: r.wanModel || this.data.selectedWanModel,
          usedWanModelLabel: wanModelLabel(r.wanModel || this.data.selectedWanModel)
        });
        tryOnStore.setStyle(id);
        this._logEvent('compose_success', { switched: true });
        this._logTryOn(id);
        try {
          const style = await styleService.get(id);
          this.setData({ style });
          this._applyStyleRatingState(style);
        } catch (e) { /* ignore */ }
      } catch (e) {
        this._logEvent('compose_fail', { error: (e && e.message) || String(e), switched: true });
        wx.showToast({ title: (e && e.message) || '换款失败', icon: 'none' });
      } finally {
        composeWaiting.stop(this);
      }
      return;
    }
    this.setData({ styleId: id });
    tryOnStore.setStyle(id);
    try {
      const style = await styleService.get(id);
      this.setData({ style });
      this._applyStyleRatingState(style);
    } catch (e) { /* ignore */ }
  },

  onRateTryonEffect(e) {
    if (this.data.ratingsLocked || !this.data.canRateStyle) return;
    this._syncRatingSubmitState({ tryonEffectDraft: Number(e.detail.value) || 0 });
  },

  onRateNailQuality(e) {
    if (this.data.ratingsLocked || !this.data.canRateStyle) return;
    this._syncRatingSubmitState({ nailQualityDraft: Number(e.detail.value) || 0 });
  },

  onSubmitRatings() {
    if (!this.data.canRateStyle || !this.data.styleId || this.data.ratingsLocked) return;
    const tryonDraft = this.data.tryonEffectDraft;
    const qualityDraft = this.data.nailQualityDraft;
    if (!(tryonDraft > 0 && qualityDraft > 0)) {
      wx.showToast({ title: '请完成试戴效果与美甲品质评分', icon: 'none' });
      return;
    }
    const tryonRecord = ratingService.commitRating(
      this.data.styleId,
      tryonDraft,
      'try-on-static',
      ratingService.RATING_TYPE_TRYON
    );
    const qualityRecord = ratingService.commitRating(
      this.data.styleId,
      qualityDraft,
      'try-on-static',
      ratingService.RATING_TYPE_QUALITY
    );
    if (!tryonRecord || !qualityRecord) {
      wx.showToast({ title: '评分提交失败', icon: 'none' });
      return;
    }
    this._logEvent('rated', { rating: tryonRecord.rating, ratingType: ratingService.RATING_TYPE_TRYON });
    this._logEvent('rated', { rating: qualityRecord.rating, ratingType: ratingService.RATING_TYPE_QUALITY });
    this.setData({ ratingsLocked: true, canSubmitRatings: false });
    wx.showToast({ title: '评分已提交', icon: 'success' });
  },
  async onSaveAndOutput() {
    if (!this.data.composedUrl) {
      wx.showToast({ title: '请先合成预览', icon: 'none' });
      return;
    }
    const quotaService = require('../../services/quota.service');
    try {
      quotaService.assertFreeHD();
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '今日出图次数已用完', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '生成 2K 中…' });
    try {
      const hd = await tryOnService.generateHD({
        sessionId: 'static',
        styleId: this.data.styleId,
        sourceUrl: this.data.composedUrl
      });
      quotaService.consumeFreeHDOnSuccess();
      const hist = {
        userOpenid: userStore.openid || 'guest',
        styleId: this.data.styleId,
        nailShape: this.data.selectedShape,
        mode: 'static',
        thumbUrl: this.data.composedUrl,
        hdUrl: hd.hdUrl
      };
      if (this.data.canRateStyle && this.data.ratingsLocked) {
        if (this.data.tryonEffectDraft) hist.tryonEffectRating = this.data.tryonEffectDraft;
        if (this.data.nailQualityDraft) hist.nailQualityRating = this.data.nailQualityDraft;
      }
      if (this.data.style && this.data.style.styleSource === 'custom-upload') {
        hist.styleSource = 'custom-upload';
        hist.styleTitle = this.data.style.title || '自定义参考图';
        hist.displayTags = ['上传参考图'];
        hist.referenceStyleFileID = this.data.style.styleImageFileID || '';
      }
      await historyService.append(hist);
      wx.hideLoading();
      this._logEvent('save_success');
      require('../../utils/hd-output-nav').navigateTo(this.data.styleId, hd.hdUrl);
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: (e && e.message) || '导出失败', icon: 'none' });
    }
  },

  // ── 行为埋点 / 试戴记录（fire-and-forget，不影响主流程）────────────────────

  _logEvent(eventType, extra) {
    if (!cloudUtil.isCloudReady()) return;
    const openid = (userStore && userStore.openid) || 'guest';
    cloudUtil.callFunction('ops', {
      action:     'logEvent',
      eventType,
      styleId:    this.data.styleId || '',
      userId:     openid,
      sessionId:  this._sessionId || '',
      extra:      extra || {},
    }).catch(() => {});
  },

  _logTryOn(styleId) {
    if (!cloudUtil.isCloudReady()) return;
    const sid = styleId || this.data.styleId;
    if (!sid || String(sid).indexOf('custom-') === 0) return;
    const openid = (userStore && userStore.openid) || 'guest';
    cloudUtil.callFunction('ops', {
      action:  'logTryOn',
      styleId: sid,
      openid,
    }).catch(() => {});
  },
});
