/**
 * listXhsHotStyles — C 端读取最新一批小红书全网热款（source=xhs-hot）
 *
 * 返回：{ ok: true, scrapeDate, styles: [...] }
 */
const cloud = require('wx-server-sdk')
const { getAll } = require('../utils/db')
const { refreshImageUrls } = require('../utils/imageRefresh')

function latestScrapeDate(styles) {
  return (styles || [])
    .map((s) => s.scrape_date || '')
    .filter(Boolean)
    .sort()
    .pop() || ''
}

async function listXhsHotStyles() {
  const rows = await getAll('styles', { source: 'xhs-hot', is_active: true })
  const scrapeDate = latestScrapeDate(rows)
  const batch = rows
    .filter((s) => !scrapeDate || s.scrape_date === scrapeDate)
    .sort((a, b) => (Number(a.xhs_rank) || 0) - (Number(b.xhs_rank) || 0))
    .slice(0, 10)

  const refreshed = await refreshImageUrls(cloud, batch)

  return {
    ok: true,
    scrapeDate,
    count: refreshed.length,
    styles: refreshed
  }
}

module.exports = { listXhsHotStyles, latestScrapeDate }
