// 特性开关 / 灰度（本地调试可复制 feature-flags.local.js.example → feature-flags.local.js）
const flags = {
  AR_FORCE_FALLBACK: false,
  MOCK_FAILURE_RATE: 0.05,
  MOCK_FAILURE_ENABLE: false,
  ENABLE_REWARDED_AD: true,
  WATERMARK_DEFAULT: true,
  USE_REAL_STYLES: true,      // true = 使用 data/ 导入的真实款式
  USE_CLOUD_TRYON: true,      // true = 静态试戴走云函数（需开通云开发 + DashScope Key）
  USE_CLOUD_LOGIN: true,      // true = 登录走云函数 login（返回真实 OPENID）
  ENABLE_FREE_HD_QUOTA: false, // 调试阶段关闭每日免费出图限额；上线前改 true
  USE_MOCK_HAND_PHOTO: true,  // true = 试戴页显示评测手照快捷选择
  SHOW_WAN_MODEL_PICKER: true, // 试戴页显示万相模型下拉（对比 2.1 / 2.7）
  DEFAULT_WAN_MODEL: 'wan2.7-image-pro', // 2.7 双图+bbox 为主路径；空则跟随云函数 env
  WAN_MODEL_OPTIONS: [
    { id: 'wanx2.1-imageedit', label: '万相 2.1（Mask 重绘）' },
    { id: 'wan2.7-image-pro', label: '万相 2.7（双图+bbox）' }
  ]
};

try {
  Object.assign(flags, require('./feature-flags.local.js'));
} catch (e) {
  /* 无本地覆盖 */
}

module.exports = flags;
