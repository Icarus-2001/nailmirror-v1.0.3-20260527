/**
 * 商家 openid / 联系方式解析（styles.merchant_id ↔ merchants.openid）
 */
const LEGACY_MERCHANT_OPENID = '0f8f1fb66a2408810038a63b137a2ed3'
const LEGACY_MERCHANT_PHONE = '17312270775'

const LEGACY_MERCHANT_IDS = new Set([
  '',
  'merchant-debug',
  LEGACY_MERCHANT_OPENID,
])

function normalizeMerchantOpenid(merchantId) {
  const id = String(merchantId || '').trim()
  if (!id || id === 'merchant-debug') return LEGACY_MERCHANT_OPENID
  return id
}

async function findMerchantByOpenid(db, openid) {
  const normalized = normalizeMerchantOpenid(openid)
  const res = await db.collection('merchants').where({ openid: normalized }).limit(1).get()
  return (res.data && res.data[0]) || null
}

function merchantContactFromDoc(merchant) {
  if (!merchant) return null
  return {
    storeName: merchant.store_name || '',
    phone: merchant.phone || '',
    province: merchant.province || '',
    city: merchant.city || '',
    businessHours: merchant.business_hours || '',
    reviewUrl: merchant.review_url || '',
    openid: merchant.openid || '',
  }
}

module.exports = {
  LEGACY_MERCHANT_OPENID,
  LEGACY_MERCHANT_PHONE,
  LEGACY_MERCHANT_IDS,
  normalizeMerchantOpenid,
  findMerchantByOpenid,
  merchantContactFromDoc,
}
