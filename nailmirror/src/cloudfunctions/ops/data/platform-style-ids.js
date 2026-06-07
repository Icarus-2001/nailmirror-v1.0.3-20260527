/**
 * 平台特供款式 id 列表（real-1 … real-25）
 * 内联自 seed/styles-data.js，供站内榜单候选池使用
 */
module.exports = Array.from({ length: 25 }, (_, i) => 'real-' + (i + 1))
