export function bytes(n) {
  if (n == null) return '–';
  if (n >= 2 ** 30) return `${(n / 2 ** 30).toFixed(1)} GB`;
  if (n >= 2 ** 20) return `${Math.round(n / 2 ** 20)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

export const number = (n) => (n == null ? '–' : n.toLocaleString('en-GB'));

export function date(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '–';
}

export const rendererLabel = (r) => (r === 'VRay' ? 'V-Ray' : r || 'Other');

export function downloadText(filename, text, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

// Excel-friendly CSV: BOM, CRLF, quoted text, formula-looking cells defused.
export function toCsv(rows) {
  const cell = (v) => {
    if (v == null || v === '') return '';
    if (typeof v === 'number') return String(v);
    let s = String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
