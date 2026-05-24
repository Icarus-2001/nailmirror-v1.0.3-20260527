// 特性开关 / 灰度
module.exports = {
  AR_FORCE_FALLBACK: false,
  MOCK_FAILURE_RATE: 0.05,
  MOCK_FAILURE_ENABLE: false,
  ENABLE_REWARDED_AD: true,
  WATERMARK_DEFAULT: true,
  USE_REAL_STYLES: true,      // true = 使用 data/ 导入的真实款式
  USE_CLOUD_TRYON: true,      // true = 静态试戴走云函数（需开通云开发 + DashScope Key）
  USE_MOCK_HAND_PHOTO: true   // true = 上传步骤自动使用 data/手型.jpg，跳过相册
};
