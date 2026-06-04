/**
 * logEvent — 用户行为漏斗埋点，写入 user_events
 *
 * 事件节点（试戴链路）：
 *   tryon_enter       进入试戴页
 *   shape_confirmed   选甲型后点下一步
 *   style_confirmed   选款式后点下一步
 *   photo_ready       手照就绪（选图/评测/mock）
 *   compose_start     点击开始合成
 *   compose_success   合成成功返回图片（同时触发 logTryOn）
 *   compose_fail      合成失败（extra.error 含错误信息）
 *   save_success      保存导出成功
 *   rated             用户打星（extra.rating）
 *
 * 用于计算各步 UV 转化率，支撑精细化运营。
 */
const cloud = require('wx-server-sdk')

const VALID_EVENTS = new Set([
  'tryon_enter', 'shape_confirmed', 'style_confirmed', 'photo_ready',
  'compose_start', 'compose_success', 'compose_fail', 'save_success', 'rated',
])

async function logEvent({ eventType, styleId, userId, sessionId, extra }) {
  if (!VALID_EVENTS.has(eventType)) {
    return { ok: false, error: '未知事件类型: ' + eventType }
  }
  const db = cloud.database()
  await db.collection('user_events').add({
    data: {
      event_type: eventType,
      style_id:   styleId   || '',
      user_id:    userId    || 'guest',
      session_id: sessionId || '',
      timestamp:  db.serverDate(),
      extra:      extra     || {},
    },
  })
  return { ok: true }
}

module.exports = { logEvent }
