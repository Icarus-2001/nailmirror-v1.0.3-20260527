/**
 * listMerchantOwnStyles — B 端读取当前商家名下全部上传款式（含已下架）
 */
const cloud = require('wx-server-sdk');
const { getAll } = require('../utils/db');
const { normalizeMerchantOpenid } = require('../utils/merchant');

async function refreshImageUrls(styles) {
  const fileIDs = styles.map((s) => s.image_file_id).filter(Boolean);
  if (!fileIDs.length) return styles;
  try {
    const res = await cloud.getTempFileURL({ fileList: fileIDs });
    if (!res || !Array.isArray(res.fileList)) return styles;
    const urlMap = {};
    res.fileList.forEach((item) => {
      if (item && item.status === 0 && item.tempFileURL) {
        urlMap[item.fileID] = item.tempFileURL;
      }
    });
    return styles.map((s) => {
      const fresh = s.image_file_id && urlMap[s.image_file_id];
      if (!fresh) return s;
      return Object.assign({}, s, { image_url: fresh });
    });
  } catch (e) {
    console.warn('[listMerchantOwnStyles] refreshImageUrls failed:', e && e.message);
    return styles;
  }
}

async function listMerchantOwnStyles({ openid }) {
  if (!openid) return { ok: false, error: '请先登录' };
  const owner = normalizeMerchantOpenid(openid);
  const styles = await getAll('styles', {
    source: 'merchant-upload',
    merchant_id: owner,
  });
  const sorted = styles.slice().sort((a, b) => {
    const ta = new Date(a.created_at || 0).getTime();
    const tb = new Date(b.created_at || 0).getTime();
    return tb - ta;
  });
  const refreshed = await refreshImageUrls(sorted);
  return { ok: true, styles: refreshed };
}

module.exports = { listMerchantOwnStyles };
