// 格式化工具
function pad2(n) { return n < 10 ? '0' + n : '' + n; }

function formatDate(ts, pattern = 'YYYY-MM-DD') {
  const d = ts ? new Date(ts) : new Date();
  const Y = d.getFullYear();
  const M = pad2(d.getMonth() + 1);
  const D = pad2(d.getDate());
  const h = pad2(d.getHours());
  const m = pad2(d.getMinutes());
  return pattern
    .replace('YYYY', Y).replace('MM', M).replace('DD', D)
    .replace('hh', h).replace('mm', m);
}

function formatHeat(n) {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000)  return (n / 1000).toFixed(1) + 'k';
  return '' + n;
}

function daysBetween(aTs, bTs) {
  const ONE = 24 * 3600 * 1000;
  return Math.floor((bTs - aTs) / ONE);
}

module.exports = { formatDate, formatHeat, daysBetween };
