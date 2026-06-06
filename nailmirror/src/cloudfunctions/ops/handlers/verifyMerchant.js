/**
 * verifyMerchant — 商家身份验证
 *
 * 校验内测口令 → 写入 merchants 集合 → 回写 users.role='b'
 *
 * 入参：{ token, phone, storeName, province, city, reviewUrl, openid }
 * 成功：{ ok: true }
 * 失败：{ ok: false, error: '...' }
 */
const cloud = require('wx-server-sdk')
const { ensureCollection } = require('../utils/collections')

// 内测口令存在云函数环境变量 MERCHANT_TOKEN，兜底硬编码
const VALID_TOKEN = process.env.MERCHANT_TOKEN || 'nailmirror2026'

async function verifyMerchant({ token, phone, storeName, province, city, reviewUrl, openid }) {
  if (String(token || '').trim() !== VALID_TOKEN) {
    return { ok: false, error: '口令错误，无法切换为商家经营模式' }
  }
  if (!phone || !storeName || !province || !city) {
    return { ok: false, error: '请填写完整信息' }
  }
  if (!openid) {
    return { ok: false, error: '请先登录' }
  }

  const db = cloud.database()
  const now = new Date().toISOString()

  // 新版云开发不会随 add 自动建表，须先 ensureCollection（与 rateStyle / logEvent 一致）
  await ensureCollection(db, 'merchants')

  // 写入/更新 merchants 集合（幂等：同一 openid 可重复提交更新信息）
  const existing = await db.collection('merchants')
    .where({ openid }).limit(1).get()

  let merchantId = ''
  let merchantAction = 'created'

  if (existing.data && existing.data.length > 0) {
    merchantId = existing.data[0]._id
    merchantAction = 'updated'
    await db.collection('merchants').doc(merchantId).update({
      data: {
        phone,
        store_name: storeName,
        province,
        city,
        review_url: reviewUrl || '',
        updated_at: now
      }
    })
  } else {
    const added = await db.collection('merchants').add({
      data: {
        openid,
        phone,
        store_name: storeName,
        province,
        city,
        review_url: reviewUrl || '',
        status: 'approved',
        created_at: now,
        updated_at: now
      }
    })
    merchantId = added._id
  }

  // 回写 users.role = 'b'（让下次 login 也保持商家身份）
  let userRoleUpdated = false
  try {
    const user = await db.collection('users').doc(openid).get()
    if (user.data) {
      await db.collection('users').doc(openid).update({
        data: { role: 'b', updated_at: now }
      })
      userRoleUpdated = true
    }
  } catch (err) {
    const msg = String((err && err.message) || err || '')
    if (msg.indexOf('does not exist') === -1 && msg.indexOf('不存在') === -1) {
      throw err
    }
  }

  return { ok: true, merchantId, merchantAction, userRoleUpdated }
}

module.exports = { verifyMerchant }
