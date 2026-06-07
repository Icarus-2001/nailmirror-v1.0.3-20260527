/**
 * 上传校验错误码 → 用户可读文案（B 端商家 / C 端试戴参考图）
 */
const CODE_MESSAGES = {
  NOT_NAIL_ART: '请上传美甲款式参考图（手指或甲片上的美甲设计）',
  DUPLICATE_EXACT: '与已上传款式重复，请勿重复上传同一张图',
  DUPLICATE_SIMILAR: '与已上传款式过于相似，请更换其他款式图',
  MISSING_FILE: '图片上传失败，请重试'
};

function messageForUploadCode(code, fallback) {
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];
  return fallback || '上传未通过，请换一张图重试';
}

function formatUploadFailure(item) {
  const code = item && item.code;
  const fallback = item && item.error;
  return messageForUploadCode(code, fallback);
}

module.exports = {
  CODE_MESSAGES,
  messageForUploadCode,
  formatUploadFailure
};
