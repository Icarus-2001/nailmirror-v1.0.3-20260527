#!/usr/bin/env node
/**
 * @deprecated 请用 node scripts/push-xhs-hot.js --latest
 * 兼容：仅生成 payload，不调用云端
 */
const { main } = require('./push-xhs-hot');

const args = process.argv.slice(2);
if (!args.includes('--dry-run')) args.push('--dry-run');
if (!args.includes('--latest') && !args.some((a, i) => a === '--file' && args[i + 1])) {
  args.unshift('--latest');
}

main(args).catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
