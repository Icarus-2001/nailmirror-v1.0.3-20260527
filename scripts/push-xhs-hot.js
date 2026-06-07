#!/usr/bin/env node
/**
 * 小红书热款 Top10：dated JSON → 云端 importXhsHotTop10（一条命令）
 *
 *   node scripts/push-xhs-hot.js --latest
 *   node scripts/push-xhs-hot.js --file data/小红书爬虫/top10_nail_art_2026-06-07.json
 *   node scripts/push-xhs-hot.js --latest --dry-run
 *
 * 云端凭证（任选其一）：
 *   - scripts/.cloud-admin.local.json（见 .cloud-admin.local.json.example）
 *   - 环境变量 TCB_SECRET_ID / TCB_SECRET_KEY / DASHSCOPE_API_KEY / ADMIN_OPENID
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CRAWLER_DIR = path.join(ROOT, 'data', '小红书爬虫');
const DEFAULT_JSON = path.join(CRAWLER_DIR, 'top10_nail_art.json');
const OUT = path.join(ROOT, 'data', 'xhs-hot-import-payload.json');
const OPS_DIR = path.join(ROOT, 'nailmirror', 'src', 'cloudfunctions', 'ops');
const CLOUD_ENV = path.join(ROOT, 'nailmirror', 'src', 'config', 'cloud-env.js');
const LOCAL_CREDS = path.join(__dirname, '.cloud-admin.local.json');

function parseArgs(argv) {
  const args = argv || process.argv.slice(2);
  const opts = {
    file: '',
    latest: false,
    dryRun: false,
    invoke: true
  };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--latest') opts.latest = true;
    else if (a === '--dry-run') {
      opts.dryRun = true;
      opts.invoke = false;
    }
    else if (a === '--no-invoke') opts.invoke = false;
    else if (a === '--invoke') opts.invoke = true;
    else if (a === '--file' && args[i + 1]) {
      opts.file = args[i + 1];
      i += 1;
    }
  }
  return opts;
}

function findLatestDatedJson() {
  if (!fs.existsSync(CRAWLER_DIR)) return '';
  const dated = fs.readdirSync(CRAWLER_DIR)
    .filter((name) => /^top10_nail_art_\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .sort()
    .reverse();
  return dated[0] ? path.join(CRAWLER_DIR, dated[0]) : '';
}

function resolveInputFile(opts) {
  if (opts.file) {
    return path.isAbsolute(opts.file) ? opts.file : path.join(ROOT, opts.file);
  }
  if (opts.latest) {
    const latest = findLatestDatedJson();
    if (latest) return latest;
    console.warn('[push-xhs-hot] 未找到 top10_nail_art_YYYY-MM-DD.json，回退到 top10_nail_art.json');
  }
  return DEFAULT_JSON;
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

function buildPayload(file) {
  if (!fs.existsSync(file)) {
    throw new Error('找不到 JSON 文件: ' + file);
  }
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error('JSON 须为非空数组');
  }
  const scrapeDate = rows[0].scrape_date || rows[0].scrapeDate || new Date().toISOString().slice(0, 10);
  return {
    action: 'importXhsHotTop10',
    scrapeDate,
    items: rows.slice(0, 10).map(mapItem),
    _sourceFile: file
  };
}

function loadCreds() {
  const fromEnv = {
    secretId: process.env.TCB_SECRET_ID || process.env.TENCENTCLOUD_SECRET_ID || '',
    secretKey: process.env.TCB_SECRET_KEY || process.env.TENCENTCLOUD_SECRET_KEY || '',
    dashscopeApiKey: process.env.DASHSCOPE_API_KEY || '',
    callerOpenid: process.env.ADMIN_OPENID || process.env.CALLER_OPENID || ''
  };
  if (fromEnv.secretId && fromEnv.secretKey) return fromEnv;
  if (!fs.existsSync(LOCAL_CREDS)) return fromEnv;
  try {
    const local = JSON.parse(fs.readFileSync(LOCAL_CREDS, 'utf8'));
    return {
      secretId: local.secretId || local.TCB_SECRET_ID || fromEnv.secretId,
      secretKey: local.secretKey || local.TCB_SECRET_KEY || fromEnv.secretKey,
      dashscopeApiKey: local.dashscopeApiKey || local.DASHSCOPE_API_KEY || fromEnv.dashscopeApiKey,
      callerOpenid: local.callerOpenid || local.ADMIN_OPENID || fromEnv.callerOpenid
    };
  } catch (e) {
    throw new Error('无法解析 ' + LOCAL_CREDS + ': ' + e.message);
  }
}

function ensureOpsDeps() {
  const sdkPath = path.join(OPS_DIR, 'node_modules', 'wx-server-sdk');
  if (fs.existsSync(sdkPath)) return;
  console.log('[push-xhs-hot] 安装 ops 云函数依赖…');
  const { execSync } = require('child_process');
  execSync('npm install --production', { cwd: OPS_DIR, stdio: 'inherit' });
}

async function invokeCloud(payload) {
  const creds = loadCreds();
  if (!creds.secretId || !creds.secretKey) {
    throw new Error(
      '缺少云开发 API 密钥。请配置 scripts/.cloud-admin.local.json（见 example）'
      + ' 或设置 TCB_SECRET_ID / TCB_SECRET_KEY 环境变量。'
    );
  }
  if (!creds.dashscopeApiKey) {
    console.warn('[push-xhs-hot] 未配置 DASHSCOPE_API_KEY，VLM 打标可能失败');
  } else {
    process.env.DASHSCOPE_API_KEY = creds.dashscopeApiKey;
  }

  ensureOpsDeps();

  const envConfig = require(CLOUD_ENV);
  const envId = envConfig.ENV_ID;
  if (!envId) throw new Error('config/cloud-env.js 未配置 ENV_ID');

  const cloud = require(path.join(OPS_DIR, 'node_modules', 'wx-server-sdk'));
  cloud.init({
    env: envId,
    secretId: creds.secretId,
    secretKey: creds.secretKey
  });

  const { importXhsHotTop10 } = require(path.join(OPS_DIR, 'handlers', 'importXhsHotTop10'));
  const event = {
    action: payload.action,
    scrapeDate: payload.scrapeDate,
    items: payload.items,
    callerOpenid: creds.callerOpenid || ''
  };
  console.log('[push-xhs-hot] 调用 importXhsHotTop10 | env:', envId, '| scrapeDate:', payload.scrapeDate);
  return importXhsHotTop10(event);
}

async function main(argv) {
  const opts = parseArgs(argv);
  if (!opts.file && !opts.latest && argv === undefined) {
    opts.latest = true;
  }

  const file = resolveInputFile(opts);
  const payload = buildPayload(file);
  const sourceFile = payload._sourceFile;
  delete payload._sourceFile;

  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), 'utf8');
  console.log('[push-xhs-hot] 源文件:', sourceFile);
  console.log('[push-xhs-hot] 已写入:', OUT);
  console.log('[push-xhs-hot] scrapeDate:', payload.scrapeDate, '| items:', payload.items.length);

  if (opts.dryRun || !opts.invoke) {
    console.log('\n[dry-run] 未调用云端。可手动粘贴到微信开发者工具 → 云函数 ops → 测试：\n');
    console.log(JSON.stringify(payload, null, 2));
    return { payload, invoked: false };
  }

  const result = await invokeCloud(payload);
  console.log('\n[push-xhs-hot] 导入完成:\n', JSON.stringify(result, null, 2));
  return { payload, invoked: true, result };
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[push-xhs-hot] 失败:', err.message || err);
    process.exit(1);
  });
}

module.exports = { main, buildPayload, findLatestDatedJson, parseArgs };
