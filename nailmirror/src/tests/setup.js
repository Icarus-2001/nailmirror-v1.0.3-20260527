// Jest setup — 模拟 wx 全局对象，使 services 在 Node 环境可跑
const storage = {};

global.wx = {
  getSystemInfoSync: () => ({ platform: 'ios', system: 'iOS 14.5', brand: 'iPhone', benchmarkLevel: -1 }),
  getStorageSync: (k) => storage[k],
  setStorageSync: (k, v) => { storage[k] = v; },
  removeStorageSync: (k) => { delete storage[k]; },
  showToast: () => {},
  showLoading: () => {},
  hideLoading: () => {},
  showModal: ({ success }) => success && success({ confirm: true }),
  setClipboardData: () => {},
  login: ({ success }) => success && success({ code: 'mock-code' }),
  navigateTo: () => {},
  redirectTo: () => {},
  switchTab: () => {},
  navigateBack: () => {},
  chooseMedia: () => {},
  saveImageToPhotosAlbum: ({ success }) => success && success(),
  downloadFile: ({ success }) => success && success({ tempFilePath: '/tmp/x.png' }),
  compressImage: ({ success }) => success && success({ tempFilePath: '/tmp/x.png' }),
  createRewardedVideoAd: null,
  createInterstitialAd: null,
  createCanvasContext: () => ({
    setStrokeStyle: () => {}, setLineWidth: () => {}, beginPath: () => {},
    moveTo: () => {}, lineTo: () => {}, stroke: () => {}, setFillStyle: () => {},
    setFontSize: () => {}, fillText: () => {}, draw: () => {}
  }),
  env: { USER_DATA_PATH: '/tmp' }
};

// 重置 storage（每个 test）
beforeEach(() => {
  Object.keys(storage).forEach((k) => delete storage[k]);
});
