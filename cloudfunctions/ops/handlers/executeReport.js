/**
 * executeReport — 执行日报中的调权策略
 * 对应 Python: app/routers/reports.py execute_report()
 *              + app/services/executor.py（原存根已通过本文件实现）
 *
 * 流程：
 *   1. 鉴权（管理员 openid）
 *   2. 读取日报 strategyJson（boosts + demotes）
 *   3. 批量更新 styles.rankWeight
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

  const strategy = report.strategyJson || { boosts: [], demotes: [] }
  const items = [...(strategy.boosts || []), ...(strategy.demotes || [])]

  const changes = []
  const logPromises = []

  for (const item of items) {
    const { styleId, newWeight } = item
    if (!styleId || newWeight == null) continue

    // 读取当前权重
    const styleDoc = await db.collection('styles').doc(styleId).get()
    if (!styleDoc.data || !styleDoc.data.isActive) continue

    const weightBefore = styleDoc.data.rankWeight || 1.0
    const weightAfter  = Math.min(5.0, Math.max(0.5, parseFloat(newWeight)))

    // 更新款式权重
    await db.collection('styles').doc(styleId).update({
      data: { rankWeight: weightAfter, updatedAt: db.serverDate() },
    })

    // 写操作日志
    logPromises.push(
      db.collection('operation_logs').add({
        data: {
          reportId,
          styleId,
          weightBefore: +weightBefore.toFixed(2),
          weightAfter:  +weightAfter.toFixed(2),
          source:       'auto',
          executedAt:   db.serverDate(),
        },
      })
    )

    changes.push({
      styleId,
      name:   styleDoc.data.title,
      before: +weightBefore.toFixed(2),
      after:  +weightAfter.toFixed(2),
    })
  }

  await Promise.all(logPromises)

  // 更新日报状态
  await db.collection('daily_reports').doc(reportId).update({
    data: { status: 'executed', executedAt: db.serverDate() },
  })

  return { executed: true, reportId, changes }
}

module.exports = { executeReport }
