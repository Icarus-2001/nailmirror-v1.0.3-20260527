/**
 * 退出商家模式时的导航策略（单测用）
 * @param {number} pageStackLength getCurrentPages().length
 * @returns {'navigateBack'|'switchTabMe'}
 */
function getExitMerchantNavAction(pageStackLength) {
  return pageStackLength > 1 ? 'navigateBack' : 'switchTabMe';
}

module.exports = { getExitMerchantNavAction };
