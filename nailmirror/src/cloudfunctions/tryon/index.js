/**
 * 云函数入口 — 必须最先导出 main，避免顶层 require 失败导致 handler 未注册
 */
exports.main = async (event, context) => {
  try {
    const { handle } = require('./handler');
    return await handle(event, context);
  } catch (e) {
    console.error('[tryon] bootstrap error', e);
    return {
      code: 1,
      message: '云函数加载失败: ' + (e && e.message ? e.message : String(e)),
      data: {
        hint: '请右键 cloudfunctions/tryon → 上传并部署：云端安装依赖（不上传 node_modules）'
      }
    };
  }
};
