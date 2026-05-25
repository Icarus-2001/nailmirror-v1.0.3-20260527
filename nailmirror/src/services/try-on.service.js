// TryOnService: startAR / startStatic / generateHD
const { mockDelay, makeError } = require('../utils/request');
const { getDeviceLevel } = require('../utils/device');
const featureFlags = require('../config/feature-flags');
const ERR = require('../config/error-codes');
const arRenderer = require('./adapters/ar-renderer').default;
const styleService = require('./style.service');
const cloudAdapter = require('./adapters/tryon-cloud-adapter');
const cloudUtil = require('../utils/cloud');
const logger = require('../utils/logger');

async function startAR(params) {
  const { styleId, shape } = params || {};
  if (!styleId) throw makeError(ERR.NOT_FOUND, '缺少款式');
  const level = getDeviceLevel();
  const forceFallback = featureFlags.AR_FORCE_FALLBACK || level === 'low';
  if (forceFallback) {
    return { sessionId: '', fallback: true, firstFrameUrl: '', reason: 'device-low' };
  }
  return arRenderer.start({ styleId, shape });
}

async function startStatic(photoPath, styleId, shapeId, opts) {
  if (!photoPath) throw makeError(ERR.UPLOAD_ERR, '未选择手照');
  if (!styleId) throw makeError(ERR.NOT_FOUND, '缺少款式');

  if (featureFlags.USE_CLOUD_TRYON && cloudUtil.isCloudReady()) {
    try {
      const style = await styleService.get(styleId);
      const wanModel = (opts && opts.wanModel) || '';
      const r = await cloudAdapter.runTryon(photoPath, style, shapeId, wanModel);
      return {
        composedUrl: r.composedUrl,
        jobId: r.jobId,
        wanModel: r.wanModel || '',
        wanBackend: r.wanBackend || '',
        keypoints: []
      };
    } catch (e) {
      logger.warn('[try-on] cloud fail', e.message);
      throw e;
    }
  }

  return mockDelay(() => ({
    composedUrl: 'https://picsum.photos/seed/' + styleId + '-static/800/1066',
    keypoints: new Array(5).fill(0).map((_, i) => ({ finger: i, x: 100 + i * 120, y: 200 }))
  }), 800, 1200);
}

async function generateHD(params) {
  const { styleId, sourceUrl } = params || {};
  if (!styleId) throw makeError(ERR.NOT_FOUND, '缺少款式');
  if (sourceUrl) {
    return {
      hdUrl: sourceUrl,
      caption: '今日美甲试戴 ✨ #' + styleId,
      watermark: featureFlags.WATERMARK_DEFAULT
    };
  }
  return mockDelay(() => ({
    hdUrl: 'https://picsum.photos/seed/' + styleId + '-hd/2000/2666',
    caption: '今日美甲上新 ✨ 风格适配、肤色友好，姐妹冲！#NailMirror #' + styleId,
    watermark: featureFlags.WATERMARK_DEFAULT
  }), 4500, 5500);
}

module.exports = { startAR, startStatic, generateHD };
