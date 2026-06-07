/**
 * getMerchantDashboard — B 端商家看板（仅当前商家已上线款式）
 */
const { getAll } = require('../utils/db');
const { listMerchantOwnStyles } = require('./listMerchantOwnStyles');
const {
  toMs,
  MS_PER_DAY,
  formatMMDD,
  buildBehaviorStore,
  aggregateWindow,
  computeHeatAsOf,
  buildLast7DayEnds,
  buildDailySeries,
  classifyTrends,
  aggregateTagHeat,
  wowPercent,
} = require('../utils/styleHeat');

function emptyDashboard(message) {
  return {
    ok: true,
    updatedAt: new Date().toISOString(),
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

async function getMerchantDashboard({ openid }) {
  if (!openid) return { ok: false, error: '请先登录' };

  const ownRes = await listMerchantOwnStyles({ openid });
  if (!ownRes || !ownRes.ok) {
    return { ok: false, error: (ownRes && ownRes.error) || '加载款式失败' };
  }

  const activeStyles = (ownRes.styles || []).filter((s) => s.is_active !== false);
  if (!activeStyles.length) {
    return emptyDashboard('暂无已上线款式，请先上传并上架款式');
  }

  const styleIdSet = new Set(activeStyles.map((s) => String(s._id)));
  const nowMs = Date.now();
  const sevenDaysAgo = nowMs - 7 * MS_PER_DAY;
  const fourteenDaysAgo = nowMs - 14 * MS_PER_DAY;

  const [events, tryLogs, favDocs] = await Promise.all([
    getAll('user_events', {}),
    getAll('try_on_logs', {}),
    getAll('user_favorites', {}),
  ]);

  const store = buildBehaviorStore(events, tryLogs, favDocs, styleIdSet);
  const dayEnds = buildLast7DayEnds(nowMs);
  const dates = dayEnds.map((end) => formatMMDD(end));

  let events7d = 0;
  let tryOn7d = 0;
  let favorites7d = 0;
  store.events.forEach((e) => { if (e.ts >= sevenDaysAgo) events7d += 1; });
  store.tryLogs.forEach((t) => { if (t.ts >= sevenDaysAgo) tryOn7d += 1; });
  store.favDocs.forEach((f) => { if (f.ts >= sevenDaysAgo) favorites7d += 1; });

  const seriesByStyle = {};
  const styleMetrics = [];

  activeStyles.forEach((row) => {
    const id = String(row._id);
    const createdAtMs = toMs(row.created_at);
    const daily = buildDailySeries(store, id, createdAtMs, dayEnds);
    seriesByStyle[id] = daily;

    const heatNow = computeHeatAsOf(store, id, createdAtMs, nowMs);
    const heatRecent7 = daily.heat.reduce((a, b) => a + b, 0);

    const prev7Ends = [];
    for (let i = 13; i >= 7; i -= 1) {
      const d = new Date(nowMs);
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
      color: aggregateTagHeat(styleMetrics, 'color'),
      style: aggregateTagHeat(styleMetrics, 'style'),
      design: aggregateTagHeat(styleMetrics, 'design'),
    },
  };
}

module.exports = { getMerchantDashboard, emptyDashboard };
