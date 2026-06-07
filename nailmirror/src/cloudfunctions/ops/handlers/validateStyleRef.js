/**
 * validateStyleRef — C 端试戴参考图：非美甲图门禁（不去重）
 *
 * 入参：{ action: 'validateStyleRef', fileID: 'cloud://...' }
 */
const cloud = require('wx-server-sdk');
const { analyzeNailStyleImage } = require('../utils/llm');
const { downloadCloudBuffer } = require('../utils/cloudImage');
const { safeUploadError, CODES, MESSAGES } = require('../utils/uploadValidation');

async function getTempUrl(fileID) {
  const res = await cloud.getTempFileURL({ fileList: [fileID] });
  const item = res && res.fileList && res.fileList[0];
  if (!item || item.status !== 0 || !item.tempFileURL) {
    throw new Error('failed to resolve temp file url');
  }
  return item.tempFileURL;
}

async function validateStyleRef(event) {
  const fileID = event && event.fileID;
  if (!fileID) {
    return { ok: false, code: 'MISSING_FILE', message: '缺少 fileID' };
  }

  try {
    await downloadCloudBuffer(cloud, fileID);
    const imageUrl = await getTempUrl(fileID);
    const result = await analyzeNailStyleImage(imageUrl);
    return {
      ok: true,
      confidence: result.confidence || 0,
      fileID
    };
  } catch (err) {
    const safe = safeUploadError(err);
    return {
      ok: false,
      code: safe.code || CODES.NOT_NAIL_ART,
      message: safe.error || MESSAGES.NOT_NAIL_ART,
      fileID
    };
  }
}

module.exports = { validateStyleRef };
