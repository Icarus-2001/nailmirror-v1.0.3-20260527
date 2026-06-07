/** 将 ops 云函数返回的 error 转为用户可读文案 */

function formatOpsError(res, fallback) {
  const raw = (res && res.error) || fallback || '操作失败';
  if (/未知 action/i.test(raw)) {
    return {
      message: '云端 ops 未部署最新版本',
      detail: '请在微信开发者工具打开 cloudfunctions/ops，右键「上传并部署：云端安装依赖」后重试。',
      needDeploy: true,
    };
  }
  return { message: raw, detail: '', needDeploy: false };
}

function showOpsError(res, fallback) {
  const err = formatOpsError(res, fallback);
  if (err.needDeploy) {
    wx.showModal({
      title: err.message,
      content: err.detail,
      showCancel: false,
      confirmText: '知道了',
    });
    return;
  }
  wx.showToast({ title: err.message, icon: 'none', duration: 2800 });
}

module.exports = { formatOpsError, showOpsError };
