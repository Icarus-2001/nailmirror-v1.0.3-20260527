#!/usr/bin/env node
/**
 * 商家看板近 7 日 Mock 数据一键注入
 *
 *   node scripts/mock-merchant-dashboard.js
 *   node scripts/mock-merchant-dashboard.js --phone 17312270775
 *   node scripts/mock-merchant-dashboard.js --dry-run
 *
 * 凭证：scripts/.cloud-admin.local.json 或 TCB_SECRET_ID / TCB_SECRET_KEY
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OPS_DIR = path.join(ROOT, 'nailmirror', 'src', 'cloudfunctions', 'ops');
const CLOUD_ENV = path.join(ROOT, 'nailmirror', 'src', 'config', 'cloud-env.js');
const LOCAL_CREDS = path.join(__dirname, '.cloud-admin.local.json');
const DEFAULT_PHONE = '17312270775';

function parseArgs(argv) {
  const args = argv || process.argv.slice(2);
  const opts = {
    phone: DEFAULT_PHONE,
    clearFirst: true,
    dryRun: false,
    invoke: true,
  };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--dry-run') {
      opts.dryRun = true;
      opts.invoke = false;
    } else if (a === '--no-invoke') opts.invoke = false;
    else if (a === '--no-clear') opts.clearFirst = false;
    else if (a === '--phone' && args[i + 1]) {
      opts.phone = args[i + 1];
      i += 1;
    }
  }
  return opts;
}

function loadCreds() {
  const fromEnv = {
    secretId: process.env.TCB_SECRET_ID || process.env.TENCENTCLOUD_SECRET_ID || '',
    secretKey: process.env.TCB_SECRET_KEY || process.env.TENCENTCLOUD_SECRET_KEY || '',
  };
  if (fromEnv.secretId && fromEnv.secretKey) return fromEnv;
  if (!fs.existsSync(LOCAL_CREDS)) return fromEnv;
  try {
    const local = JSON.parse(fs.readFileSync(LOCAL_CREDS, 'utf8'));
    return {
      secretId: local.secretId || local.TCB_SECRET_ID || fromEnv.secretId,
      secretKey: local.secretKey || local.TCB_SECRET_KEY || fromEnv.secretKey,
    };
  } catch (e) {
    throw new Error('无法解析 ' + LOCAL_CREDS + ': ' + e.message);
  }
}

function ensureOpsDeps() {
  const sdkPath = path.join(OPS_DIR, 'node_modules', 'wx-server-sdk');
  if (fs.existsSync(sdkPath)) return;
  console.log('[mock-merchant-dashboard] 安装 ops 云函数依赖…');
  const { execSync } = require('child_process');
  execSync('npm install --production', { cwd: OPS_DIR, stdio: 'inherit' });
}

async function invokeHandler(handlerName, event) {
  const creds = loadCreds();
  if (!creds.secretId || !creds.secretKey) {
    throw new Error(
      '缺少云开发 API 密钥。请配置 scripts/.cloud-admin.local.json'
      + ' 或设置 TCB_SECRET_ID / TCB_SECRET_KEY。'
    );
  }

  ensureOpsDeps();

  const envConfig = require(CLOUD_ENV);
  const envId = envConfig.ENV_ID;
  if (!envId) throw new Error('config/cloud-env.js 未配置 ENV_ID');

  const cloud = require(path.join(OPS_DIR, 'node_modules', 'wx-server-sdk'));
  cloud.init({
    env: envId,
    secretId: creds.secretId,
    secretKey: creds.secretKey,
  });

  const mod = require(path.join(OPS_DIR, 'handlers', handlerName));
  const fn = mod[handlerName];
  if (typeof fn !== 'function') {
    throw new Error('handler 不存在: ' + handlerName);
  }
  return fn(event);
}

async function main(argv) {
  const opts = parseArgs(argv);
  const mockPayload = {
    phone: opts.phone,
    clearFirst: opts.clearFirst,
  };

  console.log('[mock-merchant-dashboard] phone:', opts.phone, '| clearFirst:', opts.clearFirst);

  if (opts.dryRun || !opts.invoke) {
    console.log('\n[dry-run] 未调用云端。请在微信开发者工具 → 云函数 ops → 测试依次执行：\n');
    console.log(JSON.stringify({ action: 'mockMerchantDashboardData', ...mockPayload }, null, 2));
    console.log(JSON.stringify({ action: 'refreshMerchantDashboardSnapshots' }, null, 2));
    return { invoked: false };
  }

  console.log('[mock-merchant-dashboard] 1/2 mockMerchantDashboardData…');
  const mockRes = await invokeHandler('mockMerchantDashboardData', mockPayload);
  console.log(JSON.stringify(mockRes, null, 2));
  if (!mockRes || !mockRes.ok) {
    throw new Error((mockRes && mockRes.error) || 'mock 失败');
  }

  console.log('[mock-merchant-dashboard] 2/2 refreshMerchantDashboardSnapshots…');
  const refreshRes = await invokeHandler('refreshMerchantDashboardSnapshots', {});
  console.log(JSON.stringify(refreshRes, null, 2));
  if (!refreshRes || !refreshRes.ok) {
    throw new Error((refreshRes && refreshRes.error) || '快照刷新失败');
  }

  return { invoked: true, mockRes, refreshRes };
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[mock-merchant-dashboard] 失败:', err.message || err);
    process.exit(1);
  });
}

module.exports = { main, parseArgs, invokeHandler };
