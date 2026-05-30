/**
 * NailMirror ops 云函数 — 入口调度器
 *
 * 所有 B 端运营操作通过 action 字段路由：
 *
 *   ping            健康检查
 *   getSummary      运营数据快照（热款 / 飙升 / 冷款 / 外部趋势）
 *   generateReport  生成每日运营日报（幂等，Moonshot 同时产出日报+策略）
 *   approveReport   日报审批通过
 *   rejectReport    日报驳回
 *   executeReport   执行调权策略（写库）
 *   tagExternal     外部趋势录入 + VLM 自动打标
 *
 * 调用示例（小程序端）：
 *   wx.cloud.callFunction({ name: 'ops', data: { action: 'getSummary' } })
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { getSummary }             = require('./handlers/getSummary')
const { generateReport }         = require('./handlers/generateReport')
const { approveReport,
        rejectReport }           = require('./handlers/approveReport')
const { executeReport }          = require('./handlers/executeReport')
const { tagExternal }            = require('./handlers/tagExternal')

exports.main = async (event, context) => {
  const { action } = event
  const callerOpenid = context.FROM_OPENID || event.callerOpenid || ''

  try {
    switch (action) {
      case 'ping':
        return { ok: true, ts: Date.now(), env: cloud.DYNAMIC_CURRENT_ENV }

      case 'getSummary':
        return await getSummary(event)

      case 'generateReport':
        return await generateReport({ ...event, callerOpenid })

      case 'approveReport':
        return await approveReport({ ...event, callerOpenid })

      case 'rejectReport':
        return await rejectReport({ ...event, callerOpenid })

      case 'executeReport':
        return await executeReport({ ...event, callerOpenid })

      case 'tagExternal':
        return await tagExternal({ ...event, callerOpenid })

      default:
        return { error: `未知 action: ${action}` }
    }
  } catch (err) {
    console.error(`[ops] action=${action} failed:`, err)
    return { error: err.message || String(err) }
  }
}
