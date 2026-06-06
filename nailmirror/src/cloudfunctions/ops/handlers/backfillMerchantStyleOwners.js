/**
 * backfillMerchantStyleOwners — 历史商家款归属回填
 *
 * 将所有 source=merchant-upload 的款式的 merchant_id 统一为指定入驻商家 openid，
 * 并确保 merchants 集合存在对应档案（手机号 17312270775）。
 *
 * 仅需在内测迁移时手动调用一次。
 */
const cloud = require('wx-server-sdk')
const { getAll } = require('../utils/db')
const { ensureCollection } = require('../utils/collections')
const { LEGACY_MERCHANT_OPENID, LEGACY_MERCHANT_PHONE } = require('../utils/merchant')

async function backfillMerchantStyleOwners() {
  const db = cloud.database()
  const now = new Date().toISOString()

  await ensureCollection(db, 'merchants')
  await ensureCollection(db, 'styles')

  const existing = await db.collection('merchants')
    .where({ openid: LEGACY_MERCHANT_OPENID }).limit(1).get()

  if (existing.data && existing.data.length > 0) {
    await db.collection('merchants').doc(existing.data[0]._id).update({
      data: {
        phone: LEGACY_MERCHANT_PHONE,
        updated_at: now,
      },
    })
  } else {
    await db.collection('merchants').add({
      data: {
        openid: LEGACY_MERCHANT_OPENID,
        phone: LEGACY_MERCHANT_PHONE,
        store_name: '入驻商家',
        province: '',
        city: '',
        review_url: '',
        status: 'approved',
        created_at: now,
        updated_at: now,
      },
    })
  }

  const styles = await getAll('styles', { source: 'merchant-upload' })
  let updated = 0
  for (const style of styles) {
    if (!style || !style._id) continue
    if (style.merchant_id === LEGACY_MERCHANT_OPENID) continue
    await db.collection('styles').doc(style._id).update({
      data: { merchant_id: LEGACY_MERCHANT_OPENID, updated_at: now },
    })
    updated += 1
  }

  return {
    ok: true,
    merchantOpenid: LEGACY_MERCHANT_OPENID,
    phone: LEGACY_MERCHANT_PHONE,
    totalMerchantStyles: styles.length,
    updated,
  }
}

module.exports = { backfillMerchantStyleOwners }
