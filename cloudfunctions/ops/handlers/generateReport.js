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

async function generateReport() {
  const db = cloud.database()
  const _ = db.command
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

  // 1. 幂等检查：今日已有非 rejected 日报则直接返回
  const existing = await db.collection('daily_reports')
    .where({
      reportDate: _.gte(today).and(_.lt(tomorrow)),
      status: _.neq('rejected'),
    })
    .get()

  if (existing.data.length > 0) {
    const r = existing.data[0]
    return {
      alreadyExists: true,
      reportId: r._id,
      status: r.status,
      reportDate: r.reportDate,
    }
  }

  // 2. 运营数据快照
  const summary = await getSummary()

  // 3. 调 Moonshot 生成日报 + 策略
  const { contentMd, strategyJson } = await generateDailyReport(summary)

  // 4. 写库：今日有 rejected 则复用更新，否则新增
  const rejected = await db.collection('daily_reports')
    .where({
      reportDate: _.gte(today).and(_.lt(tomorrow)),
      status: 'rejected',
    })
    .get()

  let reportId
  if (rejected.data.length > 0) {
    reportId = rejected.data[0]._id
    await db.collection('daily_reports').doc(reportId).update({
      data: {
        contentMd,
        strategyJson,
        status: 'pending',
        createdAt: db.serverDate(),
      },
    })
  } else {
    const addRes = await db.collection('daily_reports').add({
      data: {
        reportDate: today,
        contentMd,
        strategyJson,
        status: 'pending',
        createdAt: db.serverDate(),
      },
    })
    reportId = addRes._id
  }

  return {
    reportId,
    status: 'pending',
    contentMd,
    strategyJson,
  }
}

module.exports = { generateReport }
