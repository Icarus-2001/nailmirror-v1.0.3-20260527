// 全局常量（事件、缓存 key、分页）
module.exports = {
  // 事件总线常量
  EVT_NAIL_STYLE_FAVORITED:   'event:nail-style-favorited',
  EVT_NAIL_STYLE_UNFAVORITED: 'event:nail-style-unfavorited',
  EVT_TRY_ON_HISTORY_APPENDED:'event:try-on-history-appended',
  EVT_USER_LOGIN:             'event:user-login',
  EVT_USER_LOGOUT:            'event:user-logout',
  EVT_AR_FALLBACK_TRIGGERED:  'event:ar-fallback-triggered',
  EVT_AD_REWARD_GRANTED:      'event:ad-reward-granted',

  // 缓存 key
  STORAGE_USER:       'np_user',
  STORAGE_FAVORITES:  'np_favorites',
  STORAGE_HISTORIES:  'np_histories',
  STORAGE_MERCHANT:   'np_merchant',
  STORAGE_LAST_REMOVE:'np_last_remove_date',
  STORAGE_DAILY_QUOTA:'np_daily_quota',
  STORAGE_HD_OUTPUT:  'np_hd_output_url',

  // 分页
  PAGE_SIZE: 20,

  // 品牌资源（相对小程序根目录）
  BRAND_LOGO: '/assets/logo.jpg',

  // 业务默认值
  REMOVE_CYCLE_DAYS: 21,
  DAILY_FREE_HD: 2,

  // 占位图（本地品牌资源，勿用外链 mock）
  PLACEHOLDER_IMAGE: '/assets/logo.jpg'
};
