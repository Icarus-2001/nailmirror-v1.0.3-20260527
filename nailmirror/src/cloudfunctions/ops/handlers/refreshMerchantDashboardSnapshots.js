/**
 * refreshMerchantDashboardSnapshots — 每日 10:00 写入各商家看板 T-1 快照
 */
const cloud = require('wx-server-sdk');
const { getAll } = require('../utils/db');
const { ensureCollection } = require('../utils/collections');
const {
  getDashboardAsOfMs,
  formatSnapshotDate,
} = require('../utils/styleHeat');
const { normalizeMerchantOpenid } = require('../utils/merchant');
const {
  buildMerchantDashboardPayload,
  SNAPSHOT_COLLECTION,
  snapshotDocId,
} = require('./getMerchantDashboard');

async function refreshMerchantDashboardSnapshots() {
  const db = cloud.database();
  await ensureCollection(db, SNAPSHOT_COLLECTION);

  const nowMs = Date.now();
  const asOfMs = getDashboardAsOfMs(nowMs);
  const snapshotDate = formatSnapshotDate(asOfMs);

  const [events, tryLogs, favDocs, merchantStyles] = await Promise.all([
    getAll('user_events', {}),
    getAll('try_on_logs', {}),
    getAll('user_favorites', {}),
    getAll('styles', { source: 'merchant-upload', is_active: true }),
  ]);

  const byMerchant = {};
  (merchantStyles || []).forEach((row) => {
    const merchantId = row.merchant_id || row.merchantId;
    if (!merchantId) return;
    const key = normalizeMerchantOpenid(String(merchantId));
    if (!byMerchant[key]) byMerchant[key] = [];
    byMerchant[key].push(row);
  });

  const merchantIds = Object.keys(byMerchant);
  const results = [];

  for (let i = 0; i < merchantIds.length; i += 1) {
    const merchantId = merchantIds[i];
    const activeStyles = byMerchant[merchantId];
    const payload = buildMerchantDashboardPayload({
      activeStyles,
      events,
      tryLogs,
      favDocs,
      asOfMs,
      snapshotDate,
    });

    await db.collection(SNAPSHOT_COLLECTION).doc(snapshotDocId(merchantId)).set({
      data: {
        merchant_id: merchantId,
        snapshot_date: snapshotDate,
        updated_at: db.serverDate(),
        payload,
      },
    });

    results.push({
      merchantId,
      styleCount: activeStyles.length,
      snapshot_date: snapshotDate,
    });
  }

  return {
    ok: true,
    snapshot_date: snapshotDate,
    merchantCount: results.length,
    merchants: results,
  };
}

module.exports = { refreshMerchantDashboardSnapshots };
