/**
 * generateReport — 生成每日运营日报
 * 严格对应 Python: archive/app/routers/reports.py generate_report()
 *                  + archive/app/services/llm.py generate_daily_report()
 *
 * 流程（与原 Python 一致）：
 *   1. 幂等检查（今日已有非 rejected 日报则直接返回）
 *   2. getSummary 拿运营数据快照
 *   3. 调 Moonshot 生成 { contentMd, strategyJson }（LLM 同时产出日报与调权策略）
 *   4. 写入 daily_reports（status: 'pending'）；若今日有 rejected 则复用更新
 */
const cloud = require('wx-server-sdk')
const { getSummary } = require('./getSummary')
const { generateDailyReport } = require('../utils/llm')

async function generateReport(event) {
  const mock = !!(event && event.mock)
  const db = cloud.database()
  const _ = db.command
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

  console.log('[generateReport] start, mock=', mock)

  // 1. 幂等检查：今日已有非 rejected 日报则直接返回
  const existing = await db.collection('daily_reports')
    .where({
      report_date: _.gte(today).and(_.lt(tomorrow)),
      status: _.neq('rejected'),
    })
    .get()

  if (existing.data.length > 0) {
    const r = existing.data[0]
    console.log('[generateReport] already exists', r._id, r.status)
    return {
      alreadyExists: true,
      reportId:   r._id,
      status:     r.status,
      reportDate: r.report_date,
    }
  }

  // 2. 运营数据快照
  console.log('[generateReport] fetching summary...')
  const summary = await getSummary()
  console.log('[generateReport] summary ok, hot=', summary.hotStyles.length)

  // 3. 调 Moonshot 生成日报 + 策略（mock 模式跳过 LLM，用于验证写库链路）
  let contentMd, strategyJson
  if (mock) {
    contentMd = '### 测试日报\n\n（mock 模式，未调用 Moonshot）'
    strategyJson = {
      boosts:  summary.hotStyles.slice(0, 2).map((s) => ({
        styleId: s.styleId, newWeight: 3.0, reason: 'mock 提权',
      })),
      demotes: summary.coldStyles.slice(0, 2).map((s) => ({
        styleId: s.styleId, newWeight: 0.5, reason: 'mock 降权',
      })),
      alerts:  summary.coldStyles.map((s) => ({ styleId: s.styleId, reason: 'mock 冷款' })),
    }
    console.log('[generateReport] mock content ready')
  } else {
    console.log('[generateReport] calling Moonshot...')
    const result = await generateDailyReport(summary)
    contentMd = result.contentMd
    strategyJson = result.strategyJson
    console.log('[generateReport] Moonshot ok, md length=', contentMd.length)
  }

  // 4. 写库：今日有 rejected 则复用更新，否则新增
  const rejected = await db.collection('daily_reports')
    .where({
      report_date: _.gte(today).and(_.lt(tomorrow)),
      status: 'rejected',
    })
    .get()

  let reportId
  if (rejected.data.length > 0) {
    reportId = rejected.data[0]._id
    await db.collection('daily_reports').doc(reportId).update({
      data: {
        content_md:    contentMd,
        strategy_json: strategyJson,
        status:        'pending',
        created_at:    db.serverDate(),
      },
    })
  } else {
    const addRes = await db.collection('daily_reports').add({
      data: {
        report_date:   today,
        content_md:    contentMd,
        strategy_json: strategyJson,
        status:        'pending',
        created_at:    db.serverDate(),
      },
    })
    reportId = addRes._id
  }

  console.log('[generateReport] saved', reportId)

  return {
    reportId,
    status: 'pending',
    mock,
    contentMd,
    strategyJson,
  }
}

module.exports = { generateReport }
