// 试戴合成等待：文案轮播 + 计时（0531 稳定策略下约 30 秒，见 config/tryon-strategy.js）
const MESSAGES = [
  '分析款式与指甲位置…',
  '识别五指指甲区域…',
  '读取款式参考图…',
  '万相 AI 融合美甲色彩…',
  '精修指甲光泽与边缘…',
  '最后润色，马上就好…'
];

const { ESTIMATE_COMPOSE_SEC } = require('../config/tryon-strategy');

const ROTATE_MS = 3500;
const ESTIMATE_SEC = ESTIMATE_COMPOSE_SEC;

function start(page, firstMessage) {
  stop(page);
  let idx = 0;
  const msg = firstMessage || MESSAGES[0];
  page.setData({
    composing: true,
    composeProgress: msg,
    composeWaitSec: 0,
    composeWaitTotal: ESTIMATE_SEC,
    composeWaitPercent: 0
  });
  page._composeMsgTimer = setInterval(() => {
    idx = (idx + 1) % MESSAGES.length;
    if (page.setData) page.setData({ composeProgress: MESSAGES[idx] });
  }, ROTATE_MS);
  page._composeSecTimer = setInterval(() => {
    const sec = Math.min((page.data.composeWaitSec || 0) + 1, 99);
    const total = page.data.composeWaitTotal || ESTIMATE_SEC;
    const pct = sec >= total ? 92 : Math.round((sec / total) * 100);
    if (page.setData) page.setData({ composeWaitSec: sec, composeWaitPercent: pct });
  }, 1000);
}

function stop(page) {
  if (page._composeMsgTimer) {
    clearInterval(page._composeMsgTimer);
    page._composeMsgTimer = null;
  }
  if (page._composeSecTimer) {
    clearInterval(page._composeSecTimer);
    page._composeSecTimer = null;
  }
  if (page.setData) {
    page.setData({
      composing: false,
      composeProgress: '',
      composeWaitSec: 0
    });
  }
}

module.exports = { MESSAGES, ESTIMATE_SEC, start, stop };
