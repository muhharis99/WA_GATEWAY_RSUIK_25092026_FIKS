'use strict';

function normalizeNumber(number) {
  const n = String(number || '').replace(/\D/g, '');
  if (!n) return '';
  if (n.startsWith('0')) return '62' + n.slice(1);
  if (n.startsWith('8')) return '62' + n;
  if (n.startsWith('62')) return n;
  return n;
}

module.exports = { normalizeNumber };
