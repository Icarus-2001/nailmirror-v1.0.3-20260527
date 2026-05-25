// 特性开关 / 灰度
module.exports = {
  AR_FORCE_FALLBACK: false,
  MOCK_FAILURE_RATE: 0.05,
  MOCK_FAILURE_ENABLE: false,
  ENABLE_REWARDED_AD: true,
  WATERMARK_DEFAULT: true,
  USE_REAL_STYLES: true,      // true = 使用 data/ 导入的真实款式
  USE_CLOUD_TRYON: true,      // true = 静态试戴走云函数（需开通云开发 + DashScope Key）
  USE_MOCK_HAND_PHOTO: true,  // true = 上传步骤自动使用 data/手型.jpg，跳过相册
  SHOW_WAN_MODEL_PICKER: true, // 试戴页显示万相模型下拉（对比 2.1 / 2.7）
  DEFAULT_WAN_MODEL: '',      // 空 = 跟随云函数 env；或 wanx2.1-imageedit / wan2.7-image-pro
  WAN_MODEL_OPTIONS: [
    { id: 'wanx2.1-imageedit', label: '万相 2.1（Mask 重绘）' },
    { id: 'wan2.7-image-pro', label: '万相 2.7（双图+bbox）' }
  ]
};
