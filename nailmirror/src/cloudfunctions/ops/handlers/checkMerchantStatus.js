/**
 * checkMerchantStatus — 查询 openid 是否已完成商家身份认证
 *
 * 以 merchants 集合为准（status=approved），不依赖本地 role 缓存。
 *
 * 入参：{ openid }
 * 返回：{ ok: true, verified: boolean }
 */
const cloud = require('wx-server-sdk')
const { ensureCollection } = require('../utils/collections')

async function checkMerchantStatus({ openid }) {
  if (!openid) {
    return { ok: true, verified: false }
  }

  const db = cloud.database()
  await ensureCollection(db, 'merchants')

  const res = await db.collection('merchants')
    .where({ openid })
    .limit(1)
    .get()

  const merchant = res.data && res.data[0]
  const verified = !!(merchant && merchant.status !== 'rejected')

  return { ok: true, verified }
}

module.exports = { checkMerchantStatus }
