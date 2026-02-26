/**
 * BasketShared.js
 *
 * Shared components and SQL query builders used by both InstBasket and FunderBasket.
 * All export-SQL mirrors the backend queries in main.py — if you update a query
 * in main.py, update the corresponding builder here too (they are coupled).
 *
 * The dataset name comes from ORION_SOURCE in api.js — change it there only.
 */
import React, { useState } from 'react';
import useTable from './useTable';
import { ORION_SOURCE } from '../api';

// ── SQL query builders ────────────────────────────────────────────────────────

export function buildInstWorksQuery(ids, yf, yt) {
  return `-- ORION export: all works for institution basket
-- Institution IDs: ${ids.join(', ')}
-- Year range: ${yf}–${yt}
--
-- Returns the unique work_id of every paper affiliated with
-- the selected institutions in the given year range.
-- See the Guide tab for instructions and join examples.

SELECT DISTINCT wai.work_id
FROM \`${ORION_SOURCE}.work_affiliation_institution\` wai
JOIN \`${ORION_SOURCE}.work\` w ON wai.work_id = w.work_id
WHERE wai.institution_id IN (${ids.join(', ')})
  AND w.pub_year BETWEEN ${yf} AND ${yt}
ORDER BY wai.work_id`;
}

export function buildInstCoInstQuery(ids, yf, yt) {
  return `-- ORION export: co-occurring institutions for institution basket
-- Institution IDs: ${ids.join(', ')}
-- Year range: ${yf}–${yt}
--
-- Returns institutions that share at least one paper with
-- the basket institutions, ranked by co-occurrence count.

SELECT i.institution_id, i.institution AS name,
       i.country_iso_alpha2_code AS country,
       it.institution_type AS type,
       COUNT(DISTINCT wai2.work_id) AS works_count
FROM \`${ORION_SOURCE}.work_affiliation_institution\` wai
JOIN \`${ORION_SOURCE}.work\` w ON wai.work_id = w.work_id
JOIN \`${ORION_SOURCE}.work_affiliation_institution\` wai2
    ON wai.work_id = wai2.work_id
   AND wai2.institution_id NOT IN (${ids.join(', ')})
JOIN \`${ORION_SOURCE}.institution\` i ON wai2.institution_id = i.institution_id
LEFT JOIN \`${ORION_SOURCE}.institution_type\` it ON i.institution_type_id = it.institution_type_id
WHERE wai.institution_id IN (${ids.join(', ')})
  AND w.pub_year BETWEEN ${yf} AND ${yt}
GROUP BY i.institution_id, i.institution, i.country_iso_alpha2_code, it.institution_type
ORDER BY works_count DESC`;
}

export function buildInstCoFunderQuery(ids, yf, yt) {
  return `-- ORION export: co-occurring funders for institution basket
-- Institution IDs: ${ids.join(', ')}
-- Year range: ${yf}–${yt}
--
-- Returns funders whose grants appear on papers affiliated with
-- the basket institutions, ranked by co-occurrence count.

SELECT f.funder_id, f.funder AS name,
       f.country_iso_alpha2_code AS country,
       COUNT(DISTINCT wg.work_id) AS works_count
FROM \`${ORION_SOURCE}.work_affiliation_institution\` wai
JOIN \`${ORION_SOURCE}.work\` w ON wai.work_id = w.work_id
JOIN \`${ORION_SOURCE}.work_grant\` wg ON w.work_id = wg.work_id
JOIN \`${ORION_SOURCE}.funder\` f ON wg.funder_id = f.funder_id
WHERE wai.institution_id IN (${ids.join(', ')})
  AND w.pub_year BETWEEN ${yf} AND ${yt}
GROUP BY f.funder_id, f.funder, f.country_iso_alpha2_code
ORDER BY works_count DESC`;
}

export function buildFunderWorksQuery(ids, yf, yt) {
  return `-- ORION export: all works for funder basket
-- Funder IDs: ${ids.join(', ')}
-- Year range: ${yf}–${yt}
--
-- Returns the unique work_id of every paper that acknowledges
-- funding from the selected funders in the given year range.
-- See the Guide tab for instructions and join examples.

SELECT DISTINCT wg.work_id
FROM \`${ORION_SOURCE}.work_grant\` wg
JOIN \`${ORION_SOURCE}.work\` w ON wg.work_id = w.work_id
WHERE wg.funder_id IN (${ids.join(', ')})
  AND w.pub_year BETWEEN ${yf} AND ${yt}
ORDER BY wg.work_id`;
}

export function buildFunderCoInstQuery(ids, yf, yt) {
  return `-- ORION export: co-occurring institutions for funder basket
-- Funder IDs: ${ids.join(', ')}
-- Year range: ${yf}–${yt}
--
-- Returns institutions affiliated with papers funded by
-- the basket funders, ranked by co-occurrence count.

SELECT i.institution_id, i.institution AS name,
       i.country_iso_alpha2_code AS country,
       it.institution_type AS type,
       COUNT(DISTINCT wai.work_id) AS works_count
FROM \`${ORION_SOURCE}.work_grant\` wg
JOIN \`${ORION_SOURCE}.work\` w ON wg.work_id = w.work_id
JOIN \`${ORION_SOURCE}.work_affiliation_institution\` wai ON w.work_id = wai.work_id
JOIN \`${ORION_SOURCE}.institution\` i ON wai.institution_id = i.institution_id
LEFT JOIN \`${ORION_SOURCE}.institution_type\` it ON i.institution_type_id = it.institution_type_id
WHERE wg.funder_id IN (${ids.join(', ')})
  AND w.pub_year BETWEEN ${yf} AND ${yt}
GROUP BY i.institution_id, i.institution, i.country_iso_alpha2_code, it.institution_type
ORDER BY works_count DESC`;
}

export function buildFunderCoFunderQuery(ids, yf, yt) {
  return `-- ORION export: co-occurring funders for funder basket
-- Funder IDs: ${ids.join(', ')}
-- Year range: ${yf}–${yt}
--
-- Returns other funders that co-funded the same papers as
-- the basket funders, ranked by co-occurrence count.

SELECT f.funder_id, f.funder AS name,
       f.country_iso_alpha2_code AS country,
       COUNT(DISTINCT wg2.work_id) AS works_count
FROM \`${ORION_SOURCE}.work_grant\` wg
JOIN \`${ORION_SOURCE}.work\` w ON wg.work_id = w.work_id
JOIN \`${ORION_SOURCE}.work_grant\` wg2
    ON wg.work_id = wg2.work_id
   AND wg2.funder_id NOT IN (${ids.join(', ')})
JOIN \`${ORION_SOURCE}.funder\` f ON wg2.funder_id = f.funder_id
WHERE wg.funder_id IN (${ids.join(', ')})
  AND w.pub_year BETWEEN ${yf} AND ${yt}
GROUP BY f.funder_id, f.funder, f.country_iso_alpha2_code
ORDER BY works_count DESC`;
}

// ── Shared components ─────────────────────────────────────────────────────────

export function QueryModal({ sql, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
      <div style={{ background: '#1a1d27', border: '1px solid #2d3148', borderRadius: '12px', width: '100%', maxWidth: '700px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid #2d3148' }}>
          <span style={{ fontWeight: 700, color: '#e2e8f0' }}>Export query</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '1.2rem', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          <p style={{ fontSize: '.825rem', color: '#64748b', marginBottom: '1rem', lineHeight: 1.6 }}>
            Copy and run in your <a href="https://console.cloud.google.com/bigquery" target="_blank" rel="noreferrer" style={{ color: '#7c8cff' }}>BigQuery console</a>.
            See the <strong style={{ color: '#94a3b8' }}>Guide</strong> tab for instructions.
          </p>
          <pre style={{ background: '#0f1117', border: '1px solid #2d3148', borderRadius: '8px', padding: '1rem', fontSize: '.775rem', color: '#a78bfa', overflowX: 'auto', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{sql}</pre>
        </div>
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #2d3148', display: 'flex', gap: '.75rem', justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onClose}>Close</button>
          <button className="btn" onClick={copy}>{copied ? '✓ Copied!' : 'Copy query'}</button>
        </div>
      </div>
    </div>
  );
}

export function ResultTable({ rows, type, addToBasket, loading }) {
  const tbl = useTable(rows, 1000);
  const STh = (k, label) => (
    <th onClick={() => tbl.onSort(k)} className={tbl.sortKey === k ? 'sorted' : ''}>{label}{tbl.sortIcon(k)}</th>
  );
  if (loading) return <div className="status">Running…</div>;
  if (!rows.length) return <div className="status">No results found.</div>;

  const isInst = type === 'institutions';
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>
          <th>#</th>
          {STh('name', isInst ? 'Institution' : 'Funder')}
          {isInst && STh('type', 'Type')}
          {STh('country', 'Country')}
          {STh('works_count', 'Co-occurring works')}
          <th></th>
        </tr></thead>
        <tbody>
          {tbl.visibleRows.map((r, i) => (
            <tr key={i}>
              <td className="rank">{i + 1}</td>
              <td>{r.name}</td>
              {isInst && <td>{r.type ? <span className="badge-type">{r.type}</span> : '—'}</td>}
              <td>{r.country ? <span className="badge-country">{r.country}</span> : '—'}</td>
              <td className="works">{Number(r.works_count).toLocaleString()}</td>
              <td><button className="btn secondary" style={{ padding: '.2rem .5rem', fontSize: '.75rem' }} onClick={() => addToBasket(r)}>+</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="tbl-footer">
        <span>Showing {tbl.visibleRows.length} of {rows.length} results</span>
      </div>
    </div>
  );
}
