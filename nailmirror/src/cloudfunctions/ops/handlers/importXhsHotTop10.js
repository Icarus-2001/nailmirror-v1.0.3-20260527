/**
 * importXhsHotTop10 — 小红书爬虫 Top10 导入 styles（source=xhs-hot）
 *
 * 入参：
 *   action: 'importXhsHotTop10'
 *   scrapeDate?: '2026-06-06'
 *   items: [{ cover_url, title, rank, interaction_score, note_id, note_url, scrape_date }]
 *   callerOpenid: 管理员 openid
 */
const cloud = require('wx-server-sdk')
const https = require('https')
const { tagNailImage } = require('../utils/llm')

const MAX_IMAGE_BYTES = 8 * 1024 * 1024

function _isAdmin(openid) {
  const raw = process.env.ADMIN_OPENIDS || ''
  if (!raw) return true
  return raw.split(',').map((s) => s.trim()).includes(openid)
}

function toHttpsUrl(url) {
  if (!url || typeof url !== 'string') return ''
  return url.replace(/^http:\/\//i, 'https://')
}

function safeError(err) {
  const msg = err && (err.message || err.errMsg) ? (err.message || err.errMsg) : String(err || 'unknown error')
  return msg.length > 120 ? msg.slice(0, 120) : msg
}

function sanitizeTitle(title) {
  const value = String(title || '').trim()
  return value || '小红书热款'
}

function styleIdFor(scrapeDate, rank) {
  const r = String(rank || 0).padStart(2, '0')
  return 'xhs-hot-' + scrapeDate + '-' + r
}

function rankWeightFor(score, maxScore) {
  const s = Number(score) || 0
  const max = Number(maxScore) || 1
  const ratio = max > 0 ? s / max : 0
  return Math.round((1.2 + ratio * 3) * 100) / 100
}

function guessExt(url, buf) {
  const lower = String(url || '').toLowerCase()
  if (lower.indexOf('.webp') > -1) return 'webp'
  if (lower.indexOf('.png') > -1) return 'png'
  if (buf && buf[0] === 0x89) return 'png'
  return 'jpg'
}

function httpBuffer(urlStr) {
  return new Promise((resolve, reject) => {
    https.get(urlStr, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpBuffer(toHttpsUrl(res.headers.location)).then(resolve).catch(reject)
        return
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume()
        reject(new Error('图片下载失败 HTTP ' + (res.statusCode || '?')))
        return
      }
      const chunks = []
      let total = 0
      res.on('data', (c) => {
        total += c.length
        if (total > MAX_IMAGE_BYTES) {
          res.destroy(new Error('图片过大（最大 8MB）'))
          return
        }
        chunks.push(c)
      })
      res.on('end', () => resolve(Buffer.concat(chunks)))
    }).on('error', reject)
  })
}

async function uploadCoverBuffer(buf, cloudPath) {
  const up = await cloud.uploadFile({ cloudPath, fileContent: buf })
  if (!up || !up.fileID) throw new Error('云存储未返回 fileID')
  const temp = await cloud.getTempFileURL({ fileList: [up.fileID] })
  const item = temp.fileList && temp.fileList[0]
  if (!item || item.status !== 0 || !item.tempFileURL) {
    throw new Error('获取临时 URL 失败')
  }
  return { fileID: up.fileID, url: item.tempFileURL }
}

async function upsertStyle(db, doc) {
  const styleId = doc._id
  try {
    await db.collection('styles').doc(styleId).get()
    const { _id, ...patch } = doc
    await db.collection('styles').doc(styleId).update({ data: patch })
    return Object.assign({ _id: styleId }, patch)
  } catch (e) {
    await db.collection('styles').add({ data: doc })
    return doc
  }
}

async function deactivateOldBatches(db, scrapeDate) {
  const { getAll } = require('../utils/db')
  const old = await getAll('styles', { source: 'xhs-hot', is_active: true })
  const toDeactivate = old.filter((s) => s.scrape_date && s.scrape_date !== scrapeDate)
  for (let i = 0; i < toDeactivate.length; i += 1) {
    const row = toDeactivate[i]
    try {
      await db.collection('styles').doc(row._id).update({
        data: { is_active: false, updated_at: new Date().toISOString() }
      })
    } catch (err) {
      console.warn('[importXhsHotTop10] deactivate fail', row._id, err.message)
    }
  }
  return toDeactivate.length
}

async function importOne(db, item, scrapeDate, maxScore) {
  const coverUrl = toHttpsUrl(item.cover_url || item.coverUrl || '')
  if (!coverUrl) throw new Error('missing cover_url')
  const rank = Number(item.rank) || 0
  const noteId = String(item.note_id || item.noteId || '').trim()
  const date = item.scrape_date || item.scrapeDate || scrapeDate
  const buf = await httpBuffer(coverUrl)
  const ext = guessExt(coverUrl, buf)
  const cloudPath = 'xhs-hot/' + date + '/' + String(rank).padStart(2, '0') + '.' + ext
  const uploaded = await uploadCoverBuffer(buf, cloudPath)
  const tags = await tagNailImage(uploaded.url)
  const interactionScore = Number(item.interaction_score) || 0
  const now = new Date().toISOString()
  const doc = {
    _id: styleIdFor(date, rank),
    name: tags.name || sanitizeTitle(item.title),
    color: tags.color || '',
    design: tags.design || '',
    shape: tags.shape || '',
    style: tags.style || '',
    image_url: uploaded.url,
    image_file_id: uploaded.fileID,
    rank_weight: rankWeightFor(interactionScore, maxScore),
    interaction_score: interactionScore,
    xhs_rank: rank,
    note_id: noteId,
    note_url: item.note_url || item.noteUrl || '',
    scrape_date: date,
    source: 'xhs-hot',
    is_active: true,
    created_at: now,
    updated_at: now
  }
  return upsertStyle(db, doc)
}

async function importXhsHotTop10(event) {
  const callerOpenid = event.callerOpenid || ''
  if (!_isAdmin(callerOpenid)) throw new Error('无权限：非管理员 openid')

  const items = Array.isArray(event.items) ? event.items : []
  if (!items.length) throw new Error('items 不能为空')

  const scrapeDate = event.scrapeDate
    || items[0].scrape_date
    || items[0].scrapeDate
    || new Date().toISOString().slice(0, 10)

  const maxScore = items.reduce((m, it) => Math.max(m, Number(it.interaction_score) || 0), 1)
  const db = cloud.database()
  const styles = []
  const failed = []

  for (let i = 0; i < items.length; i += 1) {
    try {
      styles.push(await importOne(db, items[i], scrapeDate, maxScore))
    } catch (err) {
      failed.push({
        rank: items[i] && items[i].rank,
        note_id: items[i] && items[i].note_id,
        title: items[i] && items[i].title,
        error: safeError(err)
      })
    }
  }

  const deactivated = await deactivateOldBatches(db, scrapeDate)

  return {
    ok: true,
    scrapeDate,
    styles,
    failed,
    deactivated
  }
}

module.exports = { importXhsHotTop10, styleIdFor, rankWeightFor, toHttpsUrl }
