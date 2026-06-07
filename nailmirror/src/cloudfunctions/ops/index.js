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
 *   importXhsHotTop10  管理员：小红书 Top10 导入 styles（VLM 打标）
 *   listXhsHotStyles   C端：读取最新一批全网热款 TOP10
 *   verifyMerchant  商家身份验证（内测口令 + 表单信息）
 *   getMerchantContact C端：商详联系商家（按款式查 merchants 真实档案）
 *   backfillMerchantStyleOwners 一次性：历史商家款归属回填
 *   checkMerchantStatus 查询 openid 是否已入驻 merchants
 *   addFavorite     C端：用户收藏款式写入 user_favorites
 *   removeFavorite  C端：用户取消收藏从 user_favorites 删除
 *   listFavorites   C端：读取用户收藏款式 ID 列表
 *   getStyleHeatScores C端：聚合 UV/试戴完成/收藏量，按公式计算站内热度
 *   refreshSiteHotRank  计算站内热度 Top10 并写入 site_hot_rank（定时/手动）
 *   listSiteHotRank     C端：读取站内热度 Top10 快照
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
const { importXhsHotTop10 }      = require('./handlers/importXhsHotTop10')
const { listXhsHotStyles }       = require('./handlers/listXhsHotStyles')
const { verifyMerchant }         = require('./handlers/verifyMerchant')
const { getMerchantContact }     = require('./handlers/getMerchantContact')
const { backfillMerchantStyleOwners } = require('./handlers/backfillMerchantStyleOwners')
const { checkMerchantStatus }      = require('./handlers/checkMerchantStatus')
const { addFavorite }              = require('./handlers/addFavorite')
const { removeFavorite }           = require('./handlers/removeFavorite')
const { listFavorites }            = require('./handlers/listFavorites')
const { getStyleHeatScores }       = require('./handlers/getStyleHeatScores')
const { refreshSiteHotRank }       = require('./handlers/refreshSiteHotRank')
const { listSiteHotRank }          = require('./handlers/listSiteHotRank')
const { resolveOpenid }            = require('./utils/resolveOpenid')

exports.main = async (event, context) => {
  const { action } = event
  const callerOpenid = resolveOpenid(
    event.callerOpenid || event.openid || event.merchantId || ''
  )

  // 定时触发器：每日 10:00 刷新站内榜单
  if (event.TriggerName === 'refreshSiteHotRank') {
    try {
      return await refreshSiteHotRank()
    } catch (err) {
      console.error('[ops] timer refreshSiteHotRank failed:', err)
      return { error: err.message || String(err) }
    }
  }

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

      case 'importXhsHotTop10':
        return await importXhsHotTop10({ ...event, callerOpenid })

      case 'listXhsHotStyles':
        return await listXhsHotStyles()

      case 'verifyMerchant':
        return await verifyMerchant(event)

      case 'getMerchantContact':
        return await getMerchantContact(event)

      case 'backfillMerchantStyleOwners':
        return await backfillMerchantStyleOwners()

      case 'checkMerchantStatus':
        return await checkMerchantStatus(event)

      // ── C端收藏（优先使用云函数上下文 OPENID，见 resolveOpenid）──────
      case 'addFavorite':
        return await addFavorite({ ...event, openid: callerOpenid || event.openid })

      case 'removeFavorite':
        return await removeFavorite({ ...event, openid: callerOpenid || event.openid })

      case 'listFavorites':
        return await listFavorites({ ...event, openid: callerOpenid || event.openid })

      // ── 站内热度计算 ───────────────────────────────────────────────
      case 'getStyleHeatScores':
        return await getStyleHeatScores()

      case 'refreshSiteHotRank':
        return await refreshSiteHotRank()

      case 'listSiteHotRank':
        return await listSiteHotRank()

      default:
        return { error: `未知 action: ${action}` }
    }
  } catch (err) {
    console.error(`[ops] action=${action} failed:`, err)
    return { error: err.message || String(err) }
  }
}
