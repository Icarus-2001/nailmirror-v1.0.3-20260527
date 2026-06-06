/**
 * getMerchantContact — C 端商详「联系商家」
 *
 * 仅 source=merchant-upload 的款式返回真实商家联系方式；其余返回 not_merchant_style。
 *
 * 入参：{ styleId }
 */
const cloud = require('wx-server-sdk')
const { ensureCollection } = require('../utils/collections')
const {
  normalizeMerchantOpenid,
  findMerchantByOpenid,
  merchantContactFromDoc,
} = require('../utils/merchant')

async function getMerchantContact({ styleId }) {
  if (!styleId) {
    return { ok: false, reason: 'missing_style', message: '款式不存在' }
  }

  const db = cloud.database()
  let style = null
  try {
    const res = await db.collection('styles').doc(styleId).get()
    style = res.data
  } catch (err) {
    const msg = String((err && err.message) || err || '')
    if (msg.indexOf('does not exist') > -1 || msg.indexOf('不存在') > -1) {
      return { ok: false, reason: 'missing_style', message: '款式不存在' }
    }
    throw err
  }

  if (!style || style.source !== 'merchant-upload' || style.is_active === false) {
    return {
      ok: false,
      reason: 'not_merchant_style',
      message: '该款式不来源于任何入驻商家',
    }
  }

  await ensureCollection(db, 'merchants')
  const merchantOpenid = normalizeMerchantOpenid(style.merchant_id)
  const merchant = await findMerchantByOpenid(db, merchantOpenid)
  const contact = merchantContactFromDoc(merchant)

  if (!contact || !contact.storeName) {
    return {
      ok: false,
      reason: 'merchant_not_found',
      message: '商家信息暂未配置',
    }
  }

  return { ok: true, contact }
}

module.exports = { getMerchantContact }
