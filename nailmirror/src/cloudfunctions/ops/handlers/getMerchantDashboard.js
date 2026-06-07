/**
 * getMerchantDashboard — B 端商家看板（仅当前商家已上线款式，T-1 数据）
 */
const cloud = require('wx-server-sdk');
const { getAll } = require('../utils/db');
const { listMerchantOwnStyles } = require('./listMerchantOwnStyles');
const { refreshImageUrls } = require('../utils/imageRefresh');
const { normalizeMerchantOpenid } = require('../utils/merchant');
const {
  toMs,
  formatMMDD,
  buildBehaviorStore,
  computeHeatAsOf,
  buildLast7DayEndsAsOf,
  buildDailySeries,
  classifyTrends,
  aggregateTagStats,
  wowPercent,
  getDashboardAsOfMs,
  formatSnapshotDate,
  startOfDayMs,
} = require('../utils/styleHeat');

const SNAPSHOT_COLLECTION = 'merchant_dashboard_snapshots';

function snapshotDocId(openid) {
  return `${normalizeMerchantOpenid(openid)}_latest`;
}

function snapPayloadLooksValid(snapPayload) {
  if (!snapPayload || !snapPayload.dataHealth) return false;
  const dh = snapPayload.dataHealth;
  if (!dh.hasRecentData) return false;
  return (Number(dh.events7d) || 0) + (Number(dh.tryOn7d) || 0) > 0;
}

function emptyDashboard(message, snapshotDate) {
  return {
    ok: true,
    updatedAt: new Date().toISOString(),
    snapshotDate: snapshotDate || '',
    dataHealth: {
      merchantStyleCount: 0,
      events7d: 0,
      tryOn7d: 0,
      favorites7d: 0,
      hasRecentData: false,
      message: message || '暂无已上线款式，上传后即可查看看板',
    },
    styles: [],
    overview: {
      dates: [],
      metricOptions: ['uv', 'tryon', 'fav', 'heat', 'conversion'],
      seriesByStyle: {},
      defaultSelectedIds: [],
    },
    trends: { hot: [], cold: [] },
    tagAnalysis: { color: [], style: [], design: [] },
  };
}

function buildMerchantDashboardPayload({
  activeStyles,
  events,
  tryLogs,
  favDocs,
  asOfMs,
  snapshotDate,
}) {
  const styleIdSet = new Set(activeStyles.map((s) => String(s._id)));
  const store = buildBehaviorStore(events, tryLogs, favDocs, styleIdSet);
  const dayEnds = buildLast7DayEndsAsOf(asOfMs);
  const dates = dayEnds.map((end) => formatMMDD(end));
  const weekStart = startOfDayMs(dayEnds[0]);

  let events7d = 0;
  let tryOn7d = 0;
  let favorites7d = 0;
  store.events.forEach((e) => {
    if (e.ts >= weekStart && e.ts <= asOfMs) events7d += 1;
  });
  store.tryLogs.forEach((t) => {
    if (t.ts >= weekStart && t.ts <= asOfMs) tryOn7d += 1;
  });
  store.favDocs.forEach((f) => {
    if (f.ts >= weekStart && f.ts <= asOfMs) favorites7d += 1;
  });

  const seriesByStyle = {};
  const styleMetrics = [];

  activeStyles.forEach((row) => {
    const id = String(row._id);
    const createdAtMs = toMs(row.created_at);
    const daily = buildDailySeries(store, id, createdAtMs, dayEnds);
    seriesByStyle[id] = daily;

    const heatNow = computeHeatAsOf(store, id, createdAtMs, asOfMs);
    const heatRecent7 = daily.heat.reduce((a, b) => a + b, 0);

    const prev7Ends = [];
    for (let i = 13; i >= 7; i -= 1) {
      const d = new Date(asOfMs);
      d.setDate(d.getDate() - i);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      prev7Ends.push(end.getTime());
    }
    const heatPrev7 = prev7Ends.reduce((sum, endMs) => (
      sum + computeHeatAsOf(store, id, createdAtMs, endMs)
    ), 0);

    const try7 = daily.tryon.reduce((a, b) => a + b, 0);
    const wowHeat = wowPercent(heatRecent7, heatPrev7);

    const coverUrl = row.image_url || row.image_file_id || '';
    const title = row.name || row.title || '商家款式';

    styleMetrics.push({
      id,
      title,
      coverUrl,
      heatNow,
      wowHeat,
      try7,
      heatSeries: daily.heat,
      color: row.color || '',
      design: row.design || '',
      style: row.style || '',
    });
  });

  styleMetrics.sort((a, b) => b.heatNow - a.heatNow);
  const defaultSelectedIds = styleMetrics.slice(0, 3).map((s) => s.id);
  const { hot, cold } = classifyTrends(styleMetrics, styleMetrics.length);

  const mapTrendItem = (item) => ({
    styleId: item.id,
    title: item.title,
    coverUrl: item.coverUrl,
    heatNow: item.heatNow,
    wowHeat: item.wowHeat,
    try7: item.try7,
    zeroTryon: item.try7 === 0,
  });

  const styles = styleMetrics.map((s) => ({
    id: s.id,
    title: s.title,
    coverUrl: s.coverUrl,
    heatNow: s.heatNow,
    wowHeat: s.wowHeat,
    tags: { color: s.color, design: s.design, style: s.style },
  }));

  const hasRecentData = events7d > 0 || tryOn7d > 0 || favorites7d > 0;

  return {
    ok: true,
    updatedAt: new Date().toISOString(),
    snapshotDate,
    dataHealth: {
      merchantStyleCount: activeStyles.length,
      events7d,
      tryOn7d,
      favorites7d,
      hasRecentData,
      message: hasRecentData
        ? ''
        : '暂无近7日行为数据，趋势图可能为空；请引导用户浏览商详、试戴或收藏',
    },
    styles,
    overview: {
      dates,
      metricOptions: ['uv', 'tryon', 'fav', 'heat', 'conversion'],
      seriesByStyle,
      defaultSelectedIds,
    },
    trends: {
      hot: hot.map(mapTrendItem),
      cold: cold.map(mapTrendItem),
    },
    tagAnalysis: {
      color: aggregateTagStats(styleMetrics, 'color'),
      style: aggregateTagStats(styleMetrics, 'style'),
      design: aggregateTagStats(styleMetrics, 'design'),
    },
  };
}

function enrichPayloadWithStyles(payload, activeStyles) {
  if (!payload || !activeStyles || !activeStyles.length) return payload;
  const coverById = {};
  activeStyles.forEach((row) => {
    const id = String(row._id);
    coverById[id] = row.image_url || '';
    if (!coverById[id] && row.image_file_id && String(row.image_file_id).indexOf('http') === 0) {
      coverById[id] = row.image_file_id;
    }
  });

  const patchCover = (item, idKey) => {
    const id = item && (item[idKey] || item.id);
    const fresh = id && coverById[String(id)];
    if (!fresh) return item;
    return Object.assign({}, item, { coverUrl: fresh });
  };

  return Object.assign({}, payload, {
    styles: (payload.styles || []).map((s) => patchCover(s, 'id')),
    trends: {
      hot: (payload.trends && payload.trends.hot || []).map((t) => patchCover(t, 'styleId')),
      cold: (payload.trends && payload.trends.cold || []).map((t) => patchCover(t, 'styleId')),
    },
  });
}

async function computeMerchantDashboard(activeStyles) {
  const nowMs = Date.now();
  const asOfMs = getDashboardAsOfMs(nowMs);
  const snapshotDate = formatSnapshotDate(asOfMs);

  const [events, tryLogs, favDocs] = await Promise.all([
    getAll('user_events', {}),
    getAll('try_on_logs', {}),
    getAll('user_favorites', {}),
  ]);

  return buildMerchantDashboardPayload({
    activeStyles,
    events,
    tryLogs,
    favDocs,
    asOfMs,
    snapshotDate,
  });
}

async function writeMerchantDashboardSnapshot(merchantOpenid, activeStyles, events, tryLogs, favDocs) {
  const db = cloud.database();
  const normalizedId = normalizeMerchantOpenid(merchantOpenid);
  const nowMs = Date.now();
  const asOfMs = getDashboardAsOfMs(nowMs);
  const snapshotDate = formatSnapshotDate(asOfMs);
  const payload = buildMerchantDashboardPayload({
    activeStyles,
    events,
    tryLogs,
    favDocs,
    asOfMs,
    snapshotDate,
  });

  await db.collection(SNAPSHOT_COLLECTION).doc(snapshotDocId(normalizedId)).set({
    data: {
      merchant_id: normalizedId,
      snapshot_date: snapshotDate,
      updated_at: db.serverDate(),
      payload,
    },
  });

  return {
    ok: true,
    merchantOpenid: normalizedId,
    snapshot_date: snapshotDate,
    dataHealth: payload.dataHealth,
  };
}

async function getMerchantDashboard({ openid }) {
  if (!openid) return { ok: false, error: '请先登录' };

  const normalizedOpenid = normalizeMerchantOpenid(openid);
  const ownRes = await listMerchantOwnStyles({ openid: normalizedOpenid });
  if (!ownRes || !ownRes.ok) {
    return { ok: false, error: (ownRes && ownRes.error) || '加载款式失败' };
  }

  const rawStyles = (ownRes.styles || []).filter((s) => s.is_active !== false);
  const activeStyles = await refreshImageUrls(cloud, rawStyles);
  const expectedSnapshotDate = formatSnapshotDate(getDashboardAsOfMs(Date.now()));

  if (!activeStyles.length) {
    return emptyDashboard('暂无已上线款式，请先上传并上架款式', expectedSnapshotDate);
  }

  try {
    const db = cloud.database();
    const snapRes = await db.collection(SNAPSHOT_COLLECTION)
      .doc(snapshotDocId(normalizedOpenid))
      .get();
    const snap = snapRes && snapRes.data;
    const snapPayload = snap && snap.payload;
    if (snap && snap.snapshot_date === expectedSnapshotDate && snapPayloadLooksValid(snapPayload)) {
      return enrichPayloadWithStyles(Object.assign({}, snapPayload, {
        fromSnapshot: true,
        snapshotDate: snap.snapshot_date,
      }), activeStyles);
    }
  } catch (err) {
    // 无快照或读取失败，现场计算兜底
  }

  const payload = await computeMerchantDashboard(activeStyles);
  const enriched = enrichPayloadWithStyles(Object.assign({}, payload, { fromSnapshot: false }), activeStyles);

  if (snapPayloadLooksValid(enriched)) {
    try {
      const db = cloud.database();
      let existingAdvice = null;
      try {
        const prev = await db.collection(SNAPSHOT_COLLECTION)
          .doc(snapshotDocId(normalizedOpenid))
          .get();
        existingAdvice = (prev.data && prev.data.ai_advice) || null;
      } catch (readErr) {
        // 无历史快照
      }
      await db.collection(SNAPSHOT_COLLECTION).doc(snapshotDocId(normalizedOpenid)).set({
        data: {
          merchant_id: normalizedOpenid,
          snapshot_date: expectedSnapshotDate,
          updated_at: db.serverDate(),
          payload: enriched,
          ai_advice: existingAdvice,
        },
      });
    } catch (err) {
      console.warn('[getMerchantDashboard] snapshot write failed:', err && err.message);
    }
  }

  return enriched;
}

module.exports = {
  getMerchantDashboard,
  emptyDashboard,
  buildMerchantDashboardPayload,
  computeMerchantDashboard,
  writeMerchantDashboardSnapshot,
  snapPayloadLooksValid,
  SNAPSHOT_COLLECTION,
  snapshotDocId,
};
