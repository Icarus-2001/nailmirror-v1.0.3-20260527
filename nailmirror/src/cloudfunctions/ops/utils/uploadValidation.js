/**
 * 上传校验错误码（商家去重 + 非美甲图门禁）
 */
const CODES = {
  NOT_NAIL_ART: 'NOT_NAIL_ART',
  DUPLICATE_EXACT: 'DUPLICATE_EXACT',
  DUPLICATE_SIMILAR: 'DUPLICATE_SIMILAR',
};

const MESSAGES = {
  NOT_NAIL_ART: '请上传美甲款式参考图（手指或甲片上的美甲设计）',
  DUPLICATE_EXACT: '与已上传款式重复，请勿重复上传同一张图',
  DUPLICATE_SIMILAR: '与已上传款式过于相似，请更换其他款式图',
};

function uploadValidationError(code, message) {
  const err = new Error(message || MESSAGES[code] || '上传校验未通过');
  err.code = code;
  return err;
}

function safeUploadError(err) {
  const code = err && err.code ? String(err.code) : '';
  const msg = err && (err.message || err.errMsg) ? (err.message || err.errMsg) : String(err || 'unknown error');
  const text = msg.length > 120 ? msg.slice(0, 120) : msg;
  return { code, error: text };
}

module.exports = {
  CODES,
  MESSAGES,
  uploadValidationError,
  safeUploadError,
};
