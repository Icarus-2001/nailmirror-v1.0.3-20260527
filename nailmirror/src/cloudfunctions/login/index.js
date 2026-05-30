/**
 * 云函数入口 — login
 */
exports.main = async (event, context) => {
  try {
    const { handle } = require('./handler');
    return await handle(event, context);
  } catch (e) {
    console.error('[login] bootstrap error', e);
    return {
      code: 1,
      message: '云函数加载失败: ' + (e && e.message ? e.message : String(e)),
      data: null
    };
  }
};
