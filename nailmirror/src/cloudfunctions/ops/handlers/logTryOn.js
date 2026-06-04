/**
 * logTryOn — 试戴成功写入 try_on_logs
 * 触发时机：客户端合成图返回成功（composedUrl 有值）后 fire-and-forget 调用
 *
 * 只记录目录款（custom- 开头的自定义参考图不计入热度统计）
 */
const cloud = require('wx-server-sdk')

async function logTryOn({ styleId, openid }) {
  if (!styleId || String(styleId).indexOf('custom-') === 0) {
    return { ok: true, skipped: true }
  }
  const db = cloud.database()
  await db.collection('try_on_logs').add({
    data: {
      style_id: styleId,
      user_id:  openid || 'guest',
      tried_at: db.serverDate(),
    },
  })
  return { ok: true }
}

module.exports = { logTryOn }
