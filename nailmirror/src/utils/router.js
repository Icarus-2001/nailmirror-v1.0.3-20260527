// 路由包装：统一 fail 处理
function go(url, type = 'navigateTo') {
  return new Promise((resolve) => {
    const fn = wx[type];
    if (!fn) { resolve(false); return; }
    fn({
      url,
      success: () => resolve(true),
      fail: () => {
        // 兜底：页面不存在则回首页
        wx.switchTab({ url: '/pages/home/index', fail: () => resolve(false), success: () => resolve(true) });
      }
    });
  });
}

module.exports = {
  navigate: (url) => go(url, 'navigateTo'),
  redirect: (url) => go(url, 'redirectTo'),
  switchTab: (url) => go(url, 'switchTab'),
  back: (delta = 1) => wx.navigateBack({ delta })
};
