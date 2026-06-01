/**
 * executeReport — 执行日报中的调权策略
 * 对应 Python: app/routers/reports.py execute_report()
 *              + app/services/executor.py（原存根已通过本文件实现）
 *
 * 流程：
 *   1. 鉴权（管理员 openid）
 *   2. 读取日报 strategyJson（boosts + demotes）
 *   3. 批量更新 styles.rank_weight
 *   4. 写入 operation_logs（审计记录）
 *   5. 日报 status → 'executed'
 */
const cloud = require('wx-server-sdk')

function _isAdmin(openid) {
  const raw = process.env.ADMIN_OPENIDS || ''
  if (!raw) return true
  return raw.split(',').map((s) => s.trim()).includes(openid)
}

async function executeReport({ reportId, callerOpenid }) {
  if (!_isAdmin(callerOpenid)) throw new Error('无权限：非管理员 openid')
  if (!reportId) throw new Error('reportId 不能为空')

  const db = cloud.database()

  // 读日报
  const reportDoc = await db.collection('daily_reports').doc(reportId).get()
  if (!reportDoc.data) throw new Error('日报不存在')

  const report = reportDoc.data
  if (report.status === 'executed') {
    return { alreadyExecuted: true, reportId }
  }
  if (report.status !== 'approved') {
    throw new Error(`日报状态为 ${report.status}，必须先 approve 才能执行`)
  }

  const strategy = report.strategy_json || { boosts: [], demotes: [] }
  const items = [...(strategy.boosts || []), ...(strategy.demotes || [])]

  const changes = []
  const logPromises = []

  for (const item of items) {
    const { styleId, newWeight } = item
    if (!styleId || newWeight == null) continue

    // 读取当前权重（字段：is_active、rank_weight）
    const styleDoc = await db.collection('styles').doc(styleId).get()
    if (!styleDoc.data || !styleDoc.data.is_active) continue

    const weightBefore = styleDoc.data.rank_weight || 1.0
    const weightAfter  = Math.min(5.0, Math.max(0.5, parseFloat(newWeight)))

    // 更新款式权重（字段：rank_weight）
    await db.collection('styles').doc(styleId).update({
      data: { rank_weight: weightAfter, updated_at: db.serverDate() },
    })

    // 写操作日志
    logPromises.push(
      db.collection('operation_logs').add({
        data: {
          report_id:     reportId,
          style_id:      styleId,
          weight_before: +weightBefore.toFixed(2),
          weight_after:  +weightAfter.toFixed(2),
          source:        'auto',
          executed_at:   db.serverDate(),
        },
      })
    )

    changes.push({
      styleId,
      name:   styleDoc.data.name,
      before: +weightBefore.toFixed(2),
      after:  +weightAfter.toFixed(2),
    })
  }

  await Promise.all(logPromises)

  // 更新日报状态
  await db.collection('daily_reports').doc(reportId).update({
    data: { status: 'executed', executed_at: db.serverDate() },
  })

  return { executed: true, reportId, changes }
}

module.exports = { executeReport }
