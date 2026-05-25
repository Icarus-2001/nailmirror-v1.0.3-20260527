// TryOn 云函数适配层
const cloudUtil = require('../../utils/cloud');
const logger = require('../../utils/logger');

function _checkResult(r) {
  if (!r) throw new Error('云函数无响应');
  if (r.code !== 0) throw new Error(r.message || '云函数错误');
  return r.data || {};
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

async function submitTryonJob(params) {
  const r = await cloudUtil.callFunction('tryon', Object.assign({ action: 'submitTryonJob' }, params));
  return _checkResult(r);
}

async function queryTryonJob(jobId) {
  const r = await cloudUtil.callFunction('tryon', { action: 'queryTryonJob', jobId });
  return _checkResult(r);
}

async function pollTryonJob(jobId, opts) {
  const interval = (opts && opts.interval) || 2500;
  const maxAttempts = (opts && opts.maxAttempts) || 40;
  for (let i = 0; i < maxAttempts; i++) {
    const data = await queryTryonJob(jobId);
    if (data.status === 'succeeded' && data.outputUrl) return data;
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
  const submitPayload = {
    fileID,
    styleId: styleMeta.id,
    styleTitle: styleMeta.title,
    styleCoverUrl: styleMeta.coverUrl || '',
    styleImageUrl: styleMeta.sourceUrl || styleMeta.coverUrl || '',
    stylePrompt: styleMeta.stylePrompt,
    color: styleMeta.color,
    design: styleMeta.design,
    shapePrompt: shapeId || (styleMeta.shapeTags && styleMeta.shapeTags[0]) || 'almond'
  };
  if (wanModel) submitPayload.wanModel = wanModel;
  const submitted = await submitTryonJob(submitPayload);
  logger.info('[tryon-cloud] submitted', submitted.jobId, 'model=', submitted.wanModel, 'nails=', submitted.nailCount);
  const done = await pollTryonJob(submitted.jobId, { maxAttempts: pollMaxAttempts(wanModel || submitted.wanModel) });
  if (!done.outputUrl) throw new Error('生图完成但未返回图片 URL');
  return {
    composedUrl: done.outputUrl,
    jobId: submitted.jobId,
    wanModel: submitted.wanModel || wanModel || '',
    wanBackend: submitted.wanBackend || ''
  };
}

module.exports = { ping, uploadHandPhoto, submitTryonJob, queryTryonJob, pollTryonJob, runTryon };
