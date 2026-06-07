/**
 * getMerchantDashboardAdvice — 读取商家看板 AI 智能建议（每日 10:00 随快照生成）
 */
const cloud = require('wx-server-sdk');
const { normalizeMerchantOpenid } = require('../utils/merchant');
const { getDashboardAsOfMs, formatSnapshotDate } = require('../utils/styleHeat');
const {
  SNAPSHOT_COLLECTION,
  snapshotDocId,
} = require('./getMerchantDashboard');

const ADVICE_MISSING_MSG = '今日建议尚未生成，请明日 10:00 后再看';

async function getMerchantDashboardAdvice({ openid }) {
  if (!openid) return { ok: false, error: '请先登录' };

  const normalizedOpenid = normalizeMerchantOpenid(openid);
  const expectedDate = formatSnapshotDate(getDashboardAsOfMs(Date.now()));

  try {
    const db = cloud.database();
    const snapRes = await db.collection(SNAPSHOT_COLLECTION)
      .doc(snapshotDocId(normalizedOpenid))
      .get();
    const snap = snapRes && snapRes.data;
    const advice = snap && snap.ai_advice;

    if (
      advice
      && advice.snapshot_date === expectedDate
      && advice.content
      && String(advice.content).trim()
    ) {
      return {
        ok: true,
        content: String(advice.content).trim(),
        snapshotDate: advice.snapshot_date,
        generatedAt: advice.generated_at || null,
        model: advice.model || '',
      };
    }
  } catch (err) {
    console.warn('[getMerchantDashboardAdvice] read failed:', err && err.message);
  }

  return { ok: false, error: ADVICE_MISSING_MSG };
}

module.exports = {
  getMerchantDashboardAdvice,
  ADVICE_MISSING_MSG,
};
