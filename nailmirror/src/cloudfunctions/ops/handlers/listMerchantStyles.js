/**
 * listMerchantStyles — 读取所有商家上传款式（source='merchant-upload'）
 *
 * C 端调用，用于全局可见性：任何用户打开款式库时都能看到商家上传款，
 * 而不仅限于上传者本人的本地缓存。
 *
 * 注意：DB 中存储的 image_url 是上传时获取的临时 URL，有效期约 2 小时。
 * 每次调用时通过 image_file_id 批量刷新临时 URL，避免 403。
 *
 * 返回：{ ok: true, styles: [...] }
 */
const cloud = require('wx-server-sdk')
const { getAll } = require('../utils/db')

async function refreshImageUrls(styles) {
  const fileIDs = styles.map((s) => s.image_file_id).filter(Boolean)
  if (!fileIDs.length) return styles

  try {
    const res = await cloud.getTempFileURL({ fileList: fileIDs })
    if (!res || !Array.isArray(res.fileList)) return styles

    const urlMap = {}
    res.fileList.forEach((item) => {
      if (item && item.status === 0 && item.tempFileURL) {
        urlMap[item.fileID] = item.tempFileURL
      }
    })

    return styles.map((s) => {
      const fresh = s.image_file_id && urlMap[s.image_file_id]
      if (!fresh) return s
      return Object.assign({}, s, { image_url: fresh })
    })
  } catch (e) {
    console.warn('[listMerchantStyles] refreshImageUrls failed, using stored urls:', e && e.message)
    return styles
  }
}

async function listMerchantStyles() {
  const styles = await getAll('styles', { source: 'merchant-upload', is_active: true })
  const refreshed = await refreshImageUrls(styles)
  return { ok: true, styles: refreshed }
}

module.exports = { listMerchantStyles }
