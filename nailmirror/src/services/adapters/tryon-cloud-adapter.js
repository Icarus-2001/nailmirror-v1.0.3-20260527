// TryOn 云函数适配层
const cloudUtil = require('../../utils/cloud');
const logger = require('../../utils/logger');
const { resolveImageLocalPath } = require('../../utils/image');
const { buildTryonCloudFields } = require('../../config/tryon-prompt');

function resolveTryonFields(styleMeta, shapeId) {
  if (!styleMeta || !styleMeta.id) {
    return buildTryonCloudFields({ title: '', color: '', design: '纯色' }, shapeId);
  }
  if (styleMeta.styleSource === 'custom-upload') {
    return buildTryonCloudFields(
      { title: styleMeta.title || '自定义参考图', color: '', design: '纯色' },
      shapeId
    );
  }
  return buildTryonCloudFields(styleMeta, shapeId);
}

function _checkResult(r) {
  if (!r) throw new Error('云函数无响应');
  if (r.code !== 0) throw new Error(r.message || '云函数错误');
  return r.data || {};
}

/** 预览用本地路径：优先 HTTPS 拉临时文件，其次 cloud:// 下载（避免 image 直接绑 fileID 白屏） */
async function resolveComposedPreviewUrl(done) {
  const outputUrl = (done && done.outputUrl) || '';
  const outputFileID = (done && done.outputFileID) || '';
  if (outputUrl && /^https?:\/\//i.test(outputUrl)) {
    try {
      const local = await resolveImageLocalPath(outputUrl);
      return { composedUrl: local, outputUrl, outputFileID };
    } catch (e) {
      logger.warn('[tryon-cloud] preview from outputUrl fail', e.message);
    }
  }
  if (outputFileID) {
    const local = await cloudUtil.downloadCloudFile(outputFileID);
    return { composedUrl: local, outputUrl, outputFileID };
  }
  if (outputUrl) {
    return { composedUrl: outputUrl, outputUrl, outputFileID };
  }
  throw new Error('生图完成但未返回图片');
}

async function ping() {
  const r = await cloudUtil.callFunction('tryon', { action: 'ping' });
  return _checkResult(r);
}

async function uploadHandPhoto(localPath) {
  const ext = (localPath.match(/\.(\w+)$/) || [])[1] || 'jpg';
  const cloudPath = 'tryon/hands/' + Date.now() + '.' + ext;
  const up = await cloudUtil.uploadFile(cloudPath, localPath);
  return up.fileID;
}

async function uploadStyleRef(localPath) {
  const ext = (localPath.match(/\.(\w+)$/) || [])[1] || 'jpg';
  const cloudPath = 'tryon/refs/' + Date.now() + '.' + ext;
  const up = await cloudUtil.uploadFile(cloudPath, localPath);
  return up.fileID;
}

async function submitTryonJob(params) {
  const r = await cloudUtil.callFunction('tryon', Object.assign({ action: 'submitTryonJob' }, params));
  return _checkResult(r);
}

async function queryTryonJob(jobId, opts) {
  const payload = { action: 'queryTryonJob', jobId };
  if (opts && opts.materialize) payload.materialize = true;
  const r = await cloudUtil.callFunction('tryon', payload);
  return _checkResult(r);
}

async function pollTryonJob(jobId, opts) {
  const interval = (opts && opts.interval) || 2500;
  const maxAttempts = (opts && opts.maxAttempts) || 40;
  for (let i = 0; i < maxAttempts; i++) {
    const data = await queryTryonJob(jobId);
    if (data.status === 'succeeded' && (data.outputFileID || data.outputUrl)) return data;
    if (data.status === 'failed') throw new Error(data.error || '试戴生图失败');
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error('试戴超时，请稍后重试');
}

function pollMaxAttempts(wanModel) {
  if (wanModel === 'wan2.7-image-pro' || wanModel === 'wan2.7-image') return 60;
  return 40;
}

async function runTryon(localPhotoPath, styleMeta, shapeId, wanModel) {
  const fileID = await uploadHandPhoto(localPhotoPath);
  const tryon = resolveTryonFields(styleMeta, shapeId);
  const isCustom = styleMeta && styleMeta.styleSource === 'custom-upload';
  const submitPayload = {
    fileID,
    styleId: styleMeta.id,
    styleTitle: tryon.styleTitle,
    shapePrompt: tryon.shapePrompt
  };
  if (isCustom && styleMeta.styleImageFileID) {
    submitPayload.styleFileID = styleMeta.styleImageFileID;
    submitPayload.styleCoverUrl = '';
    submitPayload.styleImageUrl = '';
    submitPayload.stylePrompt = '';
    submitPayload.color = '';
    submitPayload.design = '';
  } else {
    submitPayload.styleCoverUrl = styleMeta.coverUrl || '';
    submitPayload.styleImageUrl = styleMeta.sourceUrl || styleMeta.coverUrl || '';
    submitPayload.stylePrompt = tryon.stylePrompt;
    submitPayload.color = tryon.color;
    submitPayload.design = tryon.design;
  }
  if (wanModel) submitPayload.wanModel = wanModel;
  const submitted = await submitTryonJob(submitPayload);
  logger.info('[tryon-cloud] submitted', submitted.jobId, 'model=', submitted.wanModel, 'nails=', submitted.nailCount);
  const done = await pollTryonJob(submitted.jobId, { maxAttempts: pollMaxAttempts(wanModel || submitted.wanModel) });
  const preview = await resolveComposedPreviewUrl(done);
  return {
    composedUrl: preview.composedUrl,
    outputFileID: preview.outputFileID,
    outputUrl: preview.outputUrl,
    jobId: submitted.jobId,
    wanModel: submitted.wanModel || wanModel || '',
    wanBackend: submitted.wanBackend || ''
  };
}

module.exports = {
  ping,
  uploadHandPhoto,
  uploadStyleRef,
  submitTryonJob,
  queryTryonJob,
  pollTryonJob,
  runTryon,
  resolveTryonFields,
  resolveComposedPreviewUrl
};
