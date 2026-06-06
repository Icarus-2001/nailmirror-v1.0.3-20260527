/**
 * NailMirror ops 云函数 — 入口调度器
 *
 * 所有 B 端运营操作通过 action 字段路由：
 *
 *   ping            健康检查
 *   getSummary      运营数据快照（热款 / 飙升 / 冷款 / 外部趋势 / 品质分）
 *   generateReport  生成每日运营日报（幂等，Moonshot 同时产出日报+策略）
 *   approveReport   日报审批通过
 *   rejectReport    日报驳回
 *   executeReport   执行调权策略（写库）
 *   tagExternal     外部趋势录入 + VLM 自动打标
 *   uploadMerchantStyles B端：商家批量上传款式（VLM 打标写入 styles）
 *   logTryOn        C端：试戴成功写入 try_on_logs（fire-and-forget）
 *   rateStyle       C端：用户评分追加写入 style_ratings（fire-and-forget）
 *   logEvent        C端：行为漏斗埋点写入 user_events（fire-and-forget）
 *   getQualityScores C端：读取各款式云端品质分
 *   listMerchantStyles C端：读取所有商家上传款式（全局可见）
 *   verifyMerchant  商家身份验证（内测口令 + 表单信息）
 *   getMerchantContact C端：商详联系商家（按款式查 merchants 真实档案）
 *   backfillMerchantStyleOwners 一次性：历史商家款归属回填
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
const { uploadMerchantStyles }   = require('./handlers/uploadMerchantStyles')
const { logTryOn }               = require('./handlers/logTryOn')
const { rateStyle }              = require('./handlers/rateStyle')
const { logEvent }               = require('./handlers/logEvent')
const { getQualityScores }       = require('./handlers/getQualityScores')
const { listMerchantStyles }     = require('./handlers/listMerchantStyles')
const { verifyMerchant }         = require('./handlers/verifyMerchant')
const { getMerchantContact }     = require('./handlers/getMerchantContact')
const { backfillMerchantStyleOwners } = require('./handlers/backfillMerchantStyleOwners')

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

      case 'uploadMerchantStyles':
        return await uploadMerchantStyles({ ...event, callerOpenid: callerOpenid || event.merchantId || '' })

      // ── C端数据收集（无需鉴权，fire-and-forget）──────────────────
      case 'logTryOn':
        return await logTryOn(event)

      case 'rateStyle':
        return await rateStyle(event)

      case 'logEvent':
        return await logEvent(event)

      case 'getQualityScores':
        return await getQualityScores(event)

      case 'listMerchantStyles':
        return await listMerchantStyles()

      case 'verifyMerchant':
        return await verifyMerchant(event)

      case 'getMerchantContact':
        return await getMerchantContact(event)

      case 'backfillMerchantStyleOwners':
        return await backfillMerchantStyleOwners()

      default:
        return { error: `未知 action: ${action}` }
    }
  } catch (err) {
    console.error(`[ops] action=${action} failed:`, err)
    return { error: err.message || String(err) }
  }
}
