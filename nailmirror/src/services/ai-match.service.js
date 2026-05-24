// AIMatchService: matchBySnapshot
const { mockDelay, makeError } = require('../utils/request');
const ERR = require('../config/error-codes');
const adapter = require('./adapters/ai-match-adapter').default;
const allStyles = require('../mock/styles');

async function matchBySnapshot(imagePath) {
  if (!imagePath) throw makeError(ERR.UPLOAD_ERR, '未选择图片');
  try {
    const r = await adapter.matchBySnapshot(imagePath);
    if (!r.top5 || !r.top5.length) {
      // 兜底：热度前 5
      const fallback = allStyles.slice().sort((a, b) => b.heat - a.heat).slice(0, 5);
      return { top5: fallback, scores: fallback.map((_, i) => +(0.5 - i * 0.05).toFixed(3)), fallback: true };
    }
    return { top5: r.top5, scores: r.scores, fallback: false };
  } catch (e) {
    // 再兜底
    return mockDelay(() => {
      const fallback = allStyles.slice().sort((a, b) => b.heat - a.heat).slice(0, 5);
      return { top5: fallback, scores: fallback.map((_, i) => +(0.5 - i * 0.05).toFixed(3)), fallback: true, reason: 'match-error' };
    }, 100, 150);
  }
}

module.exports = { matchBySnapshot };
