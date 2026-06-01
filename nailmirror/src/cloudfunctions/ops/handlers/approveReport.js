/**
 * approveReport / rejectReport — 日报审批
 * 对应 Python: app/routers/reports.py (approve/reject 逻辑)
 *
 * 权限：校验调用者 openid 在管理员白名单内。
 * 白名单从环境变量 ADMIN_OPENIDS（逗号分隔）读取。
 */
const cloud = require('wx-server-sdk')

function _isAdmin(openid) {
  const raw = process.env.ADMIN_OPENIDS || ''
  if (!raw) return true // 开发阶段未配置白名单时放行，上线前务必配置
  return raw.split(',').map((s) => s.trim()).includes(openid)
}

async function _updateStatus(reportId, callerOpenid, newStatus) {
  if (!_isAdmin(callerOpenid)) {
    throw new Error('无权限：非管理员 openid')
  }
  if (!reportId) throw new Error('reportId 不能为空')

  const db = cloud.database()
  const doc = await db.collection('daily_reports').doc(reportId).get()
  if (!doc.data) throw new Error('日报不存在')

  const current = doc.data.status
  const validTransitions = {
    pending:  ['approved', 'rejected'],
    approved: ['rejected'],
    rejected: [],
    executed: [],
  }
  if (!(validTransitions[current] || []).includes(newStatus)) {
    throw new Error(`不允许从 ${current} 转为 ${newStatus}`)
  }

  await db.collection('daily_reports').doc(reportId).update({
    data: { status: newStatus, updatedAt: db.serverDate() },
  })

  return { reportId, status: newStatus }
}

async function approveReport({ reportId, callerOpenid }) {
  return _updateStatus(reportId, callerOpenid, 'approved')
}

async function rejectReport({ reportId, callerOpenid }) {
  return _updateStatus(reportId, callerOpenid, 'rejected')
}

module.exports = { approveReport, rejectReport }
