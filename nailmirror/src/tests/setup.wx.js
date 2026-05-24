// Jest setup — 运行于 jest 全局注入之前（setupFiles 阶段）
// 功能：注入 wx 全局对象，并暴露 storage 对象给 setupFilesAfterEach 使用
const storage = {};

global.__NM_STORAGE__ = storage;

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
