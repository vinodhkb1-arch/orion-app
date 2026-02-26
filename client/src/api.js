/**
 * Thin fetch wrapper — if the backend returns 401 (session expired or missing),
 * redirect to the login page automatically.
 */
export async function apiFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (res.status === 401) {
    window.location.href = '/?error=session_expired';
    return null;
  }
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

/**
 * Download an array of objects as a CSV file.
 * @param {object[]} rows   - array of plain objects
 * @param {string}   filename - e.g. "institutions.csv"
 */
export function exportCsv(rows, filename = 'export.csv') {
  if (!rows || rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  const escape = v => {
    if (v == null) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(','), ...rows.map(r => cols.map(c => escape(r[c])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
