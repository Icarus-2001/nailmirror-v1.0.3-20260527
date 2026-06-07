/**
 * 商家维度款式去重（MD5 完全相同 + pHash 过于相似）
 */
const { getAll } = require('./db');
const { hammingDistanceHex, getPhashThreshold } = require('./imageFingerprint');
const { uploadValidationError, CODES } = require('./uploadValidation');

async function assertNotDuplicate(db, merchantId, fingerprint) {
  const owner = String(merchantId || '').trim();
  if (!owner || !fingerprint) return;

  const rows = await getAll('styles', { source: 'merchant-upload', merchant_id: owner });
  const threshold = getPhashThreshold();

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (row.image_md5 && fingerprint.md5 && row.image_md5 === fingerprint.md5) {
      throw uploadValidationError(CODES.DUPLICATE_EXACT);
    }
    if (row.image_phash && fingerprint.phash) {
      const dist = hammingDistanceHex(row.image_phash, fingerprint.phash);
      if (dist <= threshold) {
        throw uploadValidationError(CODES.DUPLICATE_SIMILAR);
      }
    }
  }
}

module.exports = { assertNotDuplicate };
