function normalizePhone(phone) {
  return String(phone || '').replace(/[\s-]/g, '').trim();
}

function maskPhone(phone) {
  const raw = normalizePhone(phone);
  if (raw.length < 7) return '';
  return raw.slice(0, 3) + '****' + raw.slice(-4);
}

module.exports = { normalizePhone, maskPhone };
