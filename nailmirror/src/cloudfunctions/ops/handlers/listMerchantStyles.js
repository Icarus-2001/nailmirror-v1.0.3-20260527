/**
 * listMerchantStyles — 读取所有商家上传款式（source='merchant-upload'）
 *
 * C 端调用，用于全局可见性：任何用户打开款式库时都能看到商家上传款，
 * 而不仅限于上传者本人的本地缓存。
 *
 * 返回：{ ok: true, styles: [...] }
 */
const { getAll } = require('../utils/db')

async function listMerchantStyles() {
  const styles = await getAll('styles', { source: 'merchant-upload', is_active: true })
  return { ok: true, styles }
}

module.exports = { listMerchantStyles }
