/**
 * listXhsHotStyles — C 端读取小红书全网热款（source=xhs-hot）
 *
 * scope:
 *   rank（默认）— 仅 is_active 的最新一批 TOP10，供热款榜
 *   library     — 全部历史批次（含已下架），按 note_id 去重后供款式库展示
 *
 * 返回：{ ok: true, scrapeDate?, scope, styles: [...] }
 */
const cloud = require('wx-server-sdk')
const { getAll } = require('../utils/db')
const { refreshImageUrls } = require('../utils/imageRefresh')
const { dedupeXhsHotLibraryByNoteId } = require('../utils/xhsHotDedup')

function latestScrapeDate(styles) {
  return (styles || [])
    .map((s) => s.scrape_date || '')
    .filter(Boolean)
    .sort()
    .pop() || ''
}

function sortByScrapeDateDescThenRank(a, b) {
  const dateCmp = String(b.scrape_date || '').localeCompare(String(a.scrape_date || ''))
  if (dateCmp !== 0) return dateCmp
  return (Number(a.xhs_rank) || 0) - (Number(b.xhs_rank) || 0)
}

async function listXhsHotStyles(event) {
  const scope = (event && event.scope) || 'rank'

  if (scope === 'library') {
    const rows = await getAll('styles', { source: 'xhs-hot' })
    const sorted = rows.slice().sort(sortByScrapeDateDescThenRank)
    const deduped = dedupeXhsHotLibraryByNoteId(sorted).sort(sortByScrapeDateDescThenRank)
    const refreshed = await refreshImageUrls(cloud, deduped)
    return {
      ok: true,
      scope: 'library',
      count: refreshed.length,
      styles: refreshed
    }
  }

  const rows = await getAll('styles', { source: 'xhs-hot', is_active: true })
  const scrapeDate = latestScrapeDate(rows)
  const batch = rows
    .filter((s) => !scrapeDate || s.scrape_date === scrapeDate)
    .sort((a, b) => (Number(a.xhs_rank) || 0) - (Number(b.xhs_rank) || 0))
    .slice(0, 10)

  const refreshed = await refreshImageUrls(cloud, batch)

  return {
    ok: true,
    scope: 'rank',
    scrapeDate,
    count: refreshed.length,
    styles: refreshed
  }
}

module.exports = { listXhsHotStyles, latestScrapeDate, sortByScrapeDateDescThenRank }
