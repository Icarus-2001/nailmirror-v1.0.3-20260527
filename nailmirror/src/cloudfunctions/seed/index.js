/**
 * seed 云函数 — 一键灌入测试数据，让 ops 运营链路有真实数据可算
 *
 * action: 'seedAll'         → 一键全流程（耗时>3s，云端测试面板会报超时，但后台仍会继续；请用分步 action）
 * action: 'clearAll'        → 仅清空四表
 * action: 'seedStylesUsers' → 灌入 styles(25) + users(5)
 * action: 'seedTryOnLogs'   → 灌入试戴日志（lite:true 约120条，默认约300条）
 * action: 'seedExternalTrends' → 灌入外部趋势(30)
 * action: 'initCollections'   → 显式创建 style_ratings / user_events（新版云开发须先建表）
 * action: 'seedStyleRatings'  → 灌入 style_ratings（试戴效果 + 美甲品质，含半星）
 * action: 'seedUserEvents'     → 灌入 user_events 漏斗埋点样本
 * action: 'seedPhase'       → 分步执行：phase=clear|stylesUsers|logs|trends|ratings|events
 *
 * 字段命名完全对齐云数据库真实 schema（下划线）：
 *   styles:          _id, name, color, design, shape, style, image_url, rank_weight, is_active, created_at
 *   users:           _id(openid), nickname, avatar_url, role, is_member, created_at, updated_at, last_login_at
 *   try_on_logs:     style_id, tried_at, user_id
 *   external_trends: platform, post_url, engagement, color, design, shape, style, scraped_at, posted_at
 *   style_ratings:   style_id, user_id, rating, rating_type, rated_at
 *   user_events:     event_type, style_id, user_id, session_id, timestamp, extra
 */
const cloud = require('wx-server-sdk')
const STYLES_DATA = require('./styles-data')
const { tagNailImage } = require('./utils/llm')
const { ensureCollections } = require('./utils/collections')

const RATING_COLLECTIONS = ['style_ratings', 'user_events']

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const WRITE_BATCH = 100   // 批量写入条数（越大越快，但注意云函数内存）

// ─── 工具：分批 Promise.all ──────────────────────────────────────────────────

async function batchRun(items, batchSize, fn) {
  const results = []
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize)
    const chunkResults = await Promise.all(chunk.map(fn))
    results.push(...chunkResults)
  }
  return results
}

// ─── 工具：清空集合（先 get 全部 _id，再逐批 remove） ───────────────────────

async function clearCollection(db, collectionName) {
  const MAX_GET = 100
  let deleted = 0
  while (true) {
    const res = await db.collection(collectionName).limit(MAX_GET).get()
    if (!res.data || res.data.length === 0) break
    await Promise.all(res.data.map((doc) => db.collection(collectionName).doc(doc._id).remove()))
    deleted += res.data.length
    if (res.data.length < MAX_GET) break
  }
  return deleted
}

// ─── VLM 打标入口（供 seedAll 时可选调用） ──────────────────────────────────

/**
 * tagAndName(imageUrl)
 * 调用 qwen-vl-max，返回 { color, design, shape, style, name }。
 * name 已通过 normalizeVlmName 确保恰好 4 个汉字。
 * 词表封闭，标签已归一化。
 */
async function tagAndName(imageUrl) {
  return tagNailImage(imageUrl)
}

// ─── 灌入 styles（25条）──────────────────────────────────────────────────────

async function seedStyles(db, useVlm) {
  const rows = [...STYLES_DATA]

  if (useVlm) {
    for (const row of rows) {
      try {
        const tags = await tagAndName(row.image_url)
        row.color  = tags.color  || row.color
        row.design = tags.design || row.design
        row.shape  = tags.shape  || row.shape
        row.style  = tags.style  || row.style
        if (tags.name && tags.name.length === 4) row.name = tags.name
        console.log('[seed] VLM', row._id, row.name, row.color, row.design)
        await new Promise((r) => setTimeout(r, 400))
      } catch (e) {
        console.warn('[seed] VLM 失败', row._id, e.message, '→ 保留内联标签')
      }
    }
  }

  const results = await batchRun(rows, WRITE_BATCH, (row) =>
    db.collection('styles').add({
      data: {
        _id:         row._id,
        name:        row.name,
        color:       row.color,
        design:      row.design,
        shape:       row.shape,
        style:       row.style,
        image_url:   row.image_url,
        rank_weight: row.rank_weight,
        is_active:   row.is_active,
        created_at:  db.serverDate(),
      },
    })
  )
  console.log('[seed] styles 写入:', results.length, '条')
  return results.length
}

// seed 测试用户 _id，格式对齐真实微信 openid（try_on_logs.user_id 引用同一套）
const MOCK_OPENIDS = ['mock-openid-001', 'mock-openid-002', 'mock-openid-003', 'mock-openid-004', 'mock-openid-005']

function _mockUserId() {
  return MOCK_OPENIDS[_randInt(0, MOCK_OPENIDS.length - 1)]
}

// ─── 灌入 users（5条）───────────────────────────────────────────────────────

async function seedUsers(db) {
  const rows = MOCK_OPENIDS.map((openid, i) => ({
    _id:        openid,
    nickname:   '体验用户' + (i + 1),
    avatar_url: '',
    role:       'c',
    is_member:  i === 0,
  }))

  const results = await batchRun(rows, WRITE_BATCH, (row) =>
    db.collection('users').doc(row._id).set({
      data: {
        nickname:      row.nickname,
        avatar_url:    row.avatar_url,
        role:          row.role,
        is_member:     row.is_member,
        created_at:    db.serverDate(),
        updated_at:    db.serverDate(),
        last_login_at: db.serverDate(),
      },
    })
  )
  console.log('[seed] users 写入:', results.length, '条')
  return results.length
}

// ─── 灌入 try_on_logs（~300条，制造热度分层）────────────────────────────────

function _randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function _randomDate(daysAgoMin, daysAgoMax) {
  const now = Date.now()
  const ms = _randInt(daysAgoMin, daysAgoMax) * 24 * 60 * 60 * 1000
  const offset = _randInt(0, ms)
  return new Date(now - ms + offset)
}

async function seedTryOnLogs(db, lite) {
  const styleIds = STYLES_DATA.map((s) => s._id)
  // 前5款：爆款；后5款：冷款（0条）；中间15款：剩余
  const hotIds  = styleIds.slice(0, 5)
  const midIds  = styleIds.slice(5, 20)

  const logs = []

  // 爆款
  for (const id of hotIds) {
    const total  = lite ? _randInt(12, 18) : _randInt(30, 42)
    const recent = Math.ceil(total * 0.65)
    const older  = total - recent
    for (let i = 0; i < recent; i++) {
      logs.push({ style_id: id, tried_at: _randomDate(0, 3), user_id: _mockUserId() })
    }
    for (let i = 0; i < older; i++) {
      logs.push({ style_id: id, tried_at: _randomDate(4, 14), user_id: _mockUserId() })
    }
  }

  // 中间款
  for (const id of midIds) {
    const total  = lite ? _randInt(2, 4) : _randInt(6, 12)
    const recent = Math.ceil(total * 0.55)
    const older  = total - recent
    for (let i = 0; i < recent; i++) {
      logs.push({ style_id: id, tried_at: _randomDate(0, 3), user_id: _mockUserId() })
    }
    for (let i = 0; i < older; i++) {
      logs.push({ style_id: id, tried_at: _randomDate(4, 14), user_id: _mockUserId() })
    }
  }

  const results = await batchRun(logs, WRITE_BATCH, (row) =>
    db.collection('try_on_logs').add({
      data: {
        style_id: row.style_id,
        tried_at: row.tried_at,
        user_id:  row.user_id,
      },
    })
  )
  console.log('[seed] try_on_logs 写入:', results.length, '条')
  return results.length
}

// ─── 灌入 external_trends（30条）────────────────────────────────────────────

async function seedExternalTrends(db) {
  const COLORS   = ['红粉色系','黄绿色系','蓝紫色系','黑白灰色系','金属色系','美拉德色系','莫兰蒂色系','多巴胺色系']
  const DESIGNS  = ['纯色','法式','猫眼','魔镜粉','手绘','镶钻/珍珠','碎钻','微雕']
  const SHAPES   = ['短方圆','短椭圆','中长方','中长圆','中长杏仁','长梯形','长尖形','加长杏仁']
  const STYLES_L = ['日常百搭','酷飒个性','甜美少女','中式典雅','创意小众']

  // 前3款的 design+color，用于让前5条外部趋势与店内热款共振
  const HOT_COMBOS = STYLES_DATA.slice(0, 3).map((s) => ({ design: s.design, color: s.color }))

  const rand = (arr) => arr[_randInt(0, arr.length - 1)]
  const nowMs = Date.now()

  const rows = []
  for (let i = 1; i <= 30; i++) {
    const platform = i <= 15 ? 'xiaohongshu' : 'douyin'
    let design, color
    if (i <= 5) {
      // 前5条与店内前3热款色系/工艺共振
      const combo = HOT_COMBOS[(i - 1) % HOT_COMBOS.length]
      design = combo.design
      color  = combo.color
    } else {
      design = rand(DESIGNS)
      color  = rand(COLORS)
    }
    // posted_at：前10条 1~5天前，后20条 7~13天前
    const daysAgo   = i <= 10 ? _randInt(1, 5) : _randInt(7, 13)
    const postedAt  = new Date(nowMs - daysAgo * 24 * 60 * 60 * 1000)

    rows.push({
      platform,
      post_url:   'https://mock.test/post/' + i,
      engagement: _randInt(200, 5000),
      color,
      design,
      shape:      rand(SHAPES),
      style:      rand(STYLES_L),
      posted_at:  postedAt,
    })
  }

  const results = await batchRun(rows, WRITE_BATCH, (row) =>
    db.collection('external_trends').add({
      data: {
        platform:   row.platform,
        post_url:   row.post_url,
        engagement: row.engagement,
        color:      row.color,
        design:     row.design,
        shape:      row.shape,
        style:      row.style,
        posted_at:  row.posted_at,
        scraped_at: db.serverDate(),
      },
    })
  )
  console.log('[seed] external_trends 写入:', results.length, '条')
  return results.length
}

// ─── 灌入 style_ratings（试戴效果 + 美甲品质）────────────────────────────────

const RATING_SAMPLES = [3.5, 4, 4.5, 5, 3, 4.5, 5, 3.5]

async function initRatingCollections(db) {
  return ensureCollections(db, RATING_COLLECTIONS)
}

async function seedStyleRatings(db) {
  await initRatingCollections(db)
  const styleIds = STYLES_DATA.map((s) => s._id)
  const rows = []

  styleIds.forEach((styleId, idx) => {
    const tryonRating = RATING_SAMPLES[idx % RATING_SAMPLES.length]
    const qualityRating = RATING_SAMPLES[(idx + 3) % RATING_SAMPLES.length]
    rows.push({
      style_id: styleId,
      user_id: MOCK_OPENIDS[idx % MOCK_OPENIDS.length],
      rating: tryonRating,
      rating_type: 'tryon_effect',
      rated_at: _randomDate(0, 20),
    })
    rows.push({
      style_id: styleId,
      user_id: MOCK_OPENIDS[(idx + 1) % MOCK_OPENIDS.length],
      rating: qualityRating,
      rating_type: 'nail_quality',
      rated_at: _randomDate(0, 25),
    })
    if (idx < 8) {
      rows.push({
        style_id: styleId,
        user_id: MOCK_OPENIDS[(idx + 2) % MOCK_OPENIDS.length],
        rating: RATING_SAMPLES[(idx + 5) % RATING_SAMPLES.length],
        rating_type: 'nail_quality',
        rated_at: _randomDate(0, 10),
      })
    }
  })

  const results = await batchRun(rows, WRITE_BATCH, (row) =>
    db.collection('style_ratings').add({
      data: {
        style_id: row.style_id,
        user_id: row.user_id,
        rating: row.rating,
        rating_type: row.rating_type,
        rated_at: row.rated_at,
      },
    })
  )
  console.log('[seed] style_ratings 写入:', results.length, '条')
  return results.length
}

// ─── 灌入 user_events（漏斗埋点样本）────────────────────────────────────────

const EVENT_FLOW = [
  'tryon_enter',
  'shape_confirmed',
  'style_confirmed',
  'compose_start',
  'compose_success',
  'rated',
]

async function seedUserEvents(db) {
  await initRatingCollections(db)
  const styleIds = STYLES_DATA.map((s) => s._id)
  const rows = []

  for (let i = 0; i < 40; i += 1) {
    const styleId = styleIds[i % styleIds.length]
    const sessionId = 'seed-session-' + (1000 + i)
    const userId = MOCK_OPENIDS[i % MOCK_OPENIDS.length]
    EVENT_FLOW.forEach((eventType, step) => {
      rows.push({
        event_type: eventType,
        style_id: styleId,
        user_id: userId,
        session_id: sessionId,
        timestamp: _randomDate(0, 7),
        extra: eventType === 'rated'
          ? { rating: 4.5, ratingType: 'nail_quality' }
          : {},
      })
    })
  }

  const results = await batchRun(rows, WRITE_BATCH, (row) =>
    db.collection('user_events').add({
      data: {
        event_type: row.event_type,
        style_id: row.style_id,
        user_id: row.user_id,
        session_id: row.session_id,
        timestamp: row.timestamp,
        extra: row.extra,
      },
    })
  )
  console.log('[seed] user_events 写入:', results.length, '条')
  return results.length
}

// ─── 清空集合 ────────────────────────────────────────────────────────────────

async function clearAll(db) {
  const COLLECTIONS = [
    'styles', 'users', 'try_on_logs', 'external_trends',
    'style_ratings', 'user_events',
  ]
  const counts = {}
  for (const col of COLLECTIONS) {
    counts[col] = await clearCollection(db, col)
    console.log('[seed] 清空', col, counts[col], '条')
  }
  return counts
}

// ─── 主入口 ──────────────────────────────────────────────────────────────────

async function runSeedStylesUsers(db, useVlm) {
  const [stylesCount, usersCount] = await Promise.all([
    seedStyles(db, useVlm),
    seedUsers(db),
  ])
  return { styles: stylesCount, users: usersCount }
}

exports.main = async (event) => {
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
  const db = cloud.database()
  const action  = (event && event.action)  || 'seedAll'
  const useVlm  = !!(event && event.useVlm)
  const lite    = event && event.lite !== false  // 默认 lite，避免云端测试超时

  if (action === 'clearAll') {
    const cleared = await clearAll(db)
    return { action: 'clearAll', cleared }
  }

  if (action === 'clearStyleRatings') {
    const count = await clearCollection(db, 'style_ratings')
    return { action: 'clearStyleRatings', deleted: count }
  }

  if (action === 'seedStylesUsers') {
    const r = await runSeedStylesUsers(db, useVlm)
    return { action: 'seedStylesUsers', useVlm, ...r }
  }

  if (action === 'seedTryOnLogs') {
    const count = await seedTryOnLogs(db, lite)
    return { action: 'seedTryOnLogs', lite, tryOnLogs: count }
  }

  if (action === 'seedExternalTrends') {
    const count = await seedExternalTrends(db)
    return { action: 'seedExternalTrends', externalTrends: count }
  }

  if (action === 'initCollections') {
    const collections = await initRatingCollections(db)
    return { action: 'initCollections', collections }
  }

  if (action === 'seedStyleRatings') {
    const count = await seedStyleRatings(db)
    return { action: 'seedStyleRatings', styleRatings: count }
  }

  if (action === 'seedUserEvents') {
    const count = await seedUserEvents(db)
    return { action: 'seedUserEvents', userEvents: count }
  }

  if (action === 'seedPhase') {
    const phase = (event && event.phase) || 'clear'
    if (phase === 'clear') {
      const cleared = await clearAll(db)
      return { action: 'seedPhase', phase: 'clear', cleared, next: { action: 'seedPhase', phase: 'stylesUsers' } }
    }
    if (phase === 'stylesUsers') {
      const r = await runSeedStylesUsers(db, useVlm)
      return { action: 'seedPhase', phase: 'stylesUsers', useVlm, ...r, next: { action: 'seedPhase', phase: 'logs', lite } }
    }
    if (phase === 'logs') {
      const count = await seedTryOnLogs(db, lite)
      return { action: 'seedPhase', phase: 'logs', lite, tryOnLogs: count, next: { action: 'seedPhase', phase: 'trends' } }
    }
    if (phase === 'trends') {
      const count = await seedExternalTrends(db)
      return {
        action: 'seedPhase', phase: 'trends', externalTrends: count,
        next: { action: 'seedPhase', phase: 'ratings' },
      }
    }
    if (phase === 'ratings') {
      const count = await seedStyleRatings(db)
      return {
        action: 'seedPhase', phase: 'ratings', styleRatings: count,
        next: { action: 'seedPhase', phase: 'events' },
      }
    }
    if (phase === 'events') {
      const count = await seedUserEvents(db)
      return { action: 'seedPhase', phase: 'events', userEvents: count, done: true }
    }
    return {
      error: '未知 phase: ' + phase,
      valid: ['clear', 'stylesUsers', 'logs', 'trends', 'ratings', 'events'],
    }
  }

  if (action === 'seedAll') {
    console.log('[seed] seedAll 开始（全流程，云端测试面板可能3秒超时，请查看日志确认完成）')
    const cleared = await clearAll(db)
    console.log('[seed] 清空完成', cleared)

    const { styles, users } = await runSeedStylesUsers(db, useVlm)
    const logsCount    = await seedTryOnLogs(db, lite)
    const trendsCount  = await seedExternalTrends(db)
    const ratingsCount = await seedStyleRatings(db)
    const eventsCount  = await seedUserEvents(db)

    return {
      action:         'seedAll',
      useVlm,
      lite,
      cleared,
      styles,
      users,
      tryOnLogs:      logsCount,
      externalTrends: trendsCount,
      styleRatings:   ratingsCount,
      userEvents:     eventsCount,
    }
  }

  return {
    error: '未知 action: ' + action,
    valid: [
      'clearAll', 'initCollections', 'seedStylesUsers', 'seedTryOnLogs', 'seedExternalTrends',
      'seedStyleRatings', 'seedUserEvents', 'seedPhase', 'seedAll',
    ],
  }
}
