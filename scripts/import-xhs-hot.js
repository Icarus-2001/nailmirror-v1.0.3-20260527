#!/usr/bin/env node
/**
 * 从小红书爬虫 JSON 生成 ops importXhsHotTop10 云函数测试 payload
 *
 *   node scripts/import-xhs-hot.js
 *   node scripts/import-xhs-hot.js --file data/小红书爬虫/top10_nail_art.json
 *
 * 生成后：微信开发者工具 → 云函数 ops → 测试，粘贴 payload 执行。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEFAULT_JSON = path.join(ROOT, 'data', '小红书爬虫', 'top10_nail_art.json');
const OUT = path.join(ROOT, 'data', 'xhs-hot-import-payload.json');

function parseArgs() {
  const args = process.argv.slice(2);
  let file = DEFAULT_JSON;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--file' && args[i + 1]) {
      file = path.isAbsolute(args[i + 1]) ? args[i + 1] : path.join(ROOT, args[i + 1]);
      i += 1;
    }
  }
  return file;
}

function mapItem(row) {
  return {
    cover_url: row.cover_url || row.coverUrl || '',
    title: row.title || '',
    rank: row.rank,
    interaction_score: row.interaction_score,
    note_id: row.note_id || row.noteId || '',
    note_url: row.note_url || row.noteUrl || '',
    scrape_date: row.scrape_date || row.scrapeDate || ''
  };
}

function main() {
  const file = parseArgs();
  if (!fs.existsSync(file)) {
    console.error('找不到 JSON 文件:', file);
    process.exit(1);
  }
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(rows) || !rows.length) {
    console.error('JSON 须为非空数组');
    process.exit(1);
  }
  const scrapeDate = rows[0].scrape_date || rows[0].scrapeDate || new Date().toISOString().slice(0, 10);
  const payload = {
    action: 'importXhsHotTop10',
    scrapeDate,
    items: rows.slice(0, 10).map(mapItem)
  };
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), 'utf8');
  console.log('已写入:', OUT);
  console.log('scrapeDate:', scrapeDate, '| items:', payload.items.length);
  console.log('\n请在微信开发者工具 → 云函数 ops → 测试，粘贴以下 JSON：\n');
  console.log(JSON.stringify(payload, null, 2));
}

main();
