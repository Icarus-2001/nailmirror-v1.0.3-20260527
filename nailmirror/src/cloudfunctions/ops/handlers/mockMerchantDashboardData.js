/**
 * mockMerchantDashboardData — 为指定商家注入近 7 日看板演示数据（开发/验收用）
 */
const cloud = require('wx-server-sdk');
const { getAll } = require('../utils/db');
const { ensureCollection } = require('../utils/collections');
const {
  LEGACY_MERCHANT_OPENID,
  LEGACY_MERCHANT_PHONE,
  findMerchantByOpenid,
  normalizeMerchantOpenid,
} = require('../utils/merchant');
const {
  getDashboardAsOfMs,
  buildLast7DayEndsAsOf,
  formatSnapshotDate,
} = require('../utils/styleHeat');
const { writeMerchantDashboardSnapshot } = require('./getMerchantDashboard');

const MOCK_SOURCE = 'merchant-dashboard-demo';
const TARGET_STYLES = ['幻彩魔镜甲', '绿意渐变', '花漾美甲'];

const DAILY_PROFILE = {
  '幻彩魔镜甲': [
    { uv: 1, tryon: 0 },
    { uv: 2, tryon: 1 },
    { uv: 2, tryon: 1 },
    { uv: 3, tryon: 2 },
    { uv: 6, tryon: 4 },
    { uv: 10, tryon: 6 },
    { uv: 15, tryon: 8 },
  ],
  '绿意渐变': [
    { uv: 2, tryon: 1 },
    { uv: 3, tryon: 1 },
    { uv: 4, tryon: 2 },
    { uv: 5, tryon: 2 },
    { uv: 6, tryon: 3 },
    { uv: 8, tryon: 4 },
    { uv: 10, tryon: 5 },
  ],
  '花漾美甲': [
    { uv: 0, tryon: 0 },
    { uv: 0, tryon: 0 },
    { uv: 0, tryon: 0 },
    { uv: 0, tryon: 0 },
    { uv: 0, tryon: 0 },
    { uv: 0, tryon: 0 },
    { uv: 0, tryon: 0 },
  ],
};

const HOT_FAV_COUNTS = {
  '幻彩魔镜甲': 3,
  '绿意渐变': 2,
};

function styleDisplayName(row) {
  return (row && (row.name || row.title || '')).trim();
}

function timestampOnDayMs(dayEndMs, hour, minute) {
  const d = new Date(dayEndMs);
  d.setHours(hour, minute || 0, 0, 0);
  return d.getTime();
}

async function removeByStyleId(db, collectionName, styleId) {
  const rows = await getAll(collectionName, { style_id: styleId });
  let removed = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row._id) continue;
    try {
      await db.collection(collectionName).doc(row._id).remove();
      removed += 1;
    } catch (err) {
      console.warn(`[mockMerchantDashboardData] remove ${collectionName}/${row._id}:`, err && err.message);
    }
  }
  return removed;
}

async function resolveMerchantOpenid(db, phone) {
  const normalizedPhone = String(phone || '').trim();
  if (normalizedPhone) {
    const res = await db.collection('merchants').where({ phone: normalizedPhone }).limit(1).get();
    if (res.data && res.data[0] && res.data[0].openid) {
      return normalizeMerchantOpenid(String(res.data[0].openid));
    }
  }
  if (normalizedPhone === LEGACY_MERCHANT_PHONE) {
    return LEGACY_MERCHANT_OPENID;
  }
  return '';
}

async function mockMerchantDashboardData({ phone, clearFirst }) {
  const db = cloud.database();
  const merchantOpenid = await resolveMerchantOpenid(db, phone || LEGACY_MERCHANT_PHONE);
  if (!merchantOpenid) {
    return { ok: false, error: '未找到对应商家，请检查手机号' };
  }

  const merchant = await findMerchantByOpenid(db, merchantOpenid);
  const allStyles = await getAll('styles', {
    source: 'merchant-upload',
    merchant_id: merchantOpenid,
    is_active: true,
  });

  const matched = [];
  TARGET_STYLES.forEach((targetName) => {
    const hit = (allStyles || []).find((row) => styleDisplayName(row) === targetName);
    if (hit) matched.push(hit);
  });

  if (matched.length !== TARGET_STYLES.length) {
    const foundNames = (allStyles || []).map(styleDisplayName).filter(Boolean);
    return {
      ok: false,
      error: '未找全三款目标款式，请确认店内有：' + TARGET_STYLES.join('、'),
      merchantOpenid,
      foundNames,
      matchedCount: matched.length,
    };
  }

  await ensureCollection(db, 'user_events');
  await ensureCollection(db, 'user_favorites');
  await ensureCollection(db, 'merchant_dashboard_snapshots');

  const shouldClear = clearFirst !== false;
  const cleared = { user_events: 0, try_on_logs: 0, user_favorites: 0 };

  if (shouldClear) {
    for (let i = 0; i < matched.length; i += 1) {
      const styleId = String(matched[i]._id);
      cleared.user_events += await removeByStyleId(db, 'user_events', styleId);
      cleared.try_on_logs += await removeByStyleId(db, 'try_on_logs', styleId);
      cleared.user_favorites += await removeByStyleId(db, 'user_favorites', styleId);
    }
  }

  const nowMs = Date.now();
  const asOfMs = getDashboardAsOfMs(nowMs);
  const dayEnds = buildLast7DayEndsAsOf(asOfMs);
  const dayRange = {
    snapshotDate: formatSnapshotDate(asOfMs),
    from: formatSnapshotDate(dayEnds[0]),
    to: formatSnapshotDate(dayEnds[dayEnds.length - 1]),
  };

  const styleResults = [];
  let userSeq = 1;
  const insertedEvents = [];
  const insertedTryons = [];
  const insertedFavs = [];

  for (let si = 0; si < matched.length; si += 1) {
    const row = matched[si];
    const styleId = String(row._id);
    const styleName = styleDisplayName(row);
    const daily = DAILY_PROFILE[styleName] || [];
    let eventsAdded = 0;
    let tryonsAdded = 0;
    let favsAdded = 0;

    for (let di = 0; di < dayEnds.length; di += 1) {
      const spec = daily[di] || { uv: 0, tryon: 0 };
      const dayEndMs = dayEnds[di];

      for (let ui = 0; ui < spec.uv; ui += 1) {
        const userId = 'mock-dash-u' + String(userSeq).padStart(4, '0');
        userSeq += 1;
        const tsMs = timestampOnDayMs(dayEndMs, 10 + (ui % 8), ui * 3);
        const eventDoc = {
          event_type: 'style_detail_view',
          style_id: styleId,
          user_id: userId,
          session_id: 'mock-dash-session-' + styleId + '-' + di + '-' + ui,
          timestamp: tsMs,
          extra: { source: 'style_detail', mock_source: MOCK_SOURCE },
        };
        await db.collection('user_events').add({ data: eventDoc });
        insertedEvents.push(eventDoc);
        eventsAdded += 1;
      }

      for (let ti = 0; ti < spec.tryon; ti += 1) {
        const userId = 'mock-dash-t' + String(userSeq).padStart(4, '0');
        userSeq += 1;
        const tsMs = timestampOnDayMs(dayEndMs, 14 + (ti % 6), ti * 5);
        const tryDoc = {
          style_id: styleId,
          user_id: userId,
          tried_at: tsMs,
          mock_source: MOCK_SOURCE,
        };
        await db.collection('try_on_logs').add({ data: tryDoc });
        insertedTryons.push(tryDoc);
        tryonsAdded += 1;
      }
    }

    const favTarget = HOT_FAV_COUNTS[styleName] || 0;
    for (let fi = 0; fi < favTarget; fi += 1) {
      const userId = 'mock-dash-f' + String(userSeq).padStart(4, '0');
      userSeq += 1;
      const dayEndMs = dayEnds[dayEnds.length - 1 - (fi % 3)];
      const tsMs = timestampOnDayMs(dayEndMs, 16 + fi, fi * 7);
      const favDoc = {
        style_id: styleId,
        user_id: userId,
        created_at: tsMs,
        mock_source: MOCK_SOURCE,
      };
      await db.collection('user_favorites').add({ data: favDoc });
      insertedFavs.push(favDoc);
      favsAdded += 1;
    }

    styleResults.push({
      id: styleId,
      name: styleName,
      role: styleName === '花漾美甲' ? 'cold' : 'hot',
      events: eventsAdded,
      tryons: tryonsAdded,
      favs: favsAdded,
    });
  }

  const snapshotRes = await writeMerchantDashboardSnapshot(
    merchantOpenid,
    matched,
    insertedEvents,
    insertedTryons,
    insertedFavs,
  );

  return {
    ok: true,
    merchantOpenid,
    merchantPhone: (merchant && merchant.phone) || phone || LEGACY_MERCHANT_PHONE,
    storeName: (merchant && merchant.store_name) || '',
    cleared: shouldClear ? cleared : null,
    dayRange,
    styles: styleResults,
    mockSource: MOCK_SOURCE,
    snapshot: snapshotRes,
  };
}

module.exports = {
  mockMerchantDashboardData,
  MOCK_SOURCE,
  TARGET_STYLES,
  DAILY_PROFILE,
};
