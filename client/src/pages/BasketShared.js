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

const SA = '112226578999-compute@developer.gserviceaccount.com';

/**
 * Shown when a query returns a 403 — guides the user through fixing their
 * IAM / BigQuery API setup without leaving the page.
 */
export function PermissionError({ projectId }) {
  const iamUrl = projectId
    ? `https://console.cloud.google.com/iam-admin/iam?project=${projectId}`
    : 'https://console.cloud.google.com/iam-admin/iam';
  const bqUrl = projectId
    ? `https://console.cloud.google.com/apis/library/bigquery.googleapis.com?project=${projectId}`
    : 'https://console.cloud.google.com/apis/library/bigquery.googleapis.com';

  return (
    <div style={{ background: '#2d1515', border: '1px solid #7f1d1d', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.75rem' }}>
        <span style={{ fontSize: '1rem' }}>🔒</span>
        <span style={{ fontSize: '.85rem', fontWeight: 700, color: '#fca5a5' }}>
          Permission error — your project needs a one-time setup
        </span>
      </div>
      <p style={{ fontSize: '.8rem', color: '#f87171', lineHeight: 1.7, marginBottom: '1rem' }}>
        ORION couldn't run a query on project{' '}
        {projectId ? <strong style={{ color: '#fca5a5' }}>{projectId}</strong> : 'your project'}.
        Complete the two steps below, then try again.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
        <div style={{ background: '#1a0a0a', border: '1px solid #7f1d1d', borderRadius: '8px', padding: '.85rem 1rem' }}>
          <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#fca5a5', marginBottom: '.35rem' }}>
            Step 1 — Enable the BigQuery API
          </div>
          <a href={bqUrl} target="_blank" rel="noreferrer" style={{ fontSize: '.78rem', color: '#93c5fd' }}>
            Enable BigQuery API{projectId ? ` on ${projectId}` : ''} ↗
          </a>
        </div>

        <div style={{ background: '#1a0a0a', border: '1px solid #7f1d1d', borderRadius: '8px', padding: '.85rem 1rem' }}>
          <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#fca5a5', marginBottom: '.35rem' }}>
            Step 2 — Grant BigQuery Job User role
          </div>
          <p style={{ fontSize: '.78rem', color: '#f87171', lineHeight: 1.6, margin: '0 0 .5rem' }}>
            Open <a href={iamUrl} target="_blank" rel="noreferrer" style={{ color: '#93c5fd' }}>
              IAM for your project ↗
            </a>, click <strong style={{ color: '#fca5a5' }}>Grant Access</strong>, and add:
          </p>
          <div style={{ background: '#0f0505', borderRadius: '6px', padding: '.6rem .85rem', marginBottom: '.3rem' }}>
            <div style={{ fontSize: '.72rem', color: '#7f1d1d', marginBottom: '.2rem' }}>New principal:</div>
            <code style={{ color: '#f9a8d4', fontSize: '.77rem', userSelect: 'all', wordBreak: 'break-all' }}>{SA}</code>
          </div>
          <div style={{ background: '#0f0505', borderRadius: '6px', padding: '.6rem .85rem' }}>
            <div style={{ fontSize: '.72rem', color: '#7f1d1d', marginBottom: '.2rem' }}>Role:</div>
            <code style={{ color: '#86efac', fontSize: '.77rem' }}>BigQuery Job User</code>
          </div>
        </div>
      </div>

      <p style={{ fontSize: '.72rem', color: '#7f1d1d', lineHeight: 1.6, marginTop: '.75rem', marginBottom: 0 }}>
        After saving, wait a few seconds and try your search again.
        This is a one-time setup — you won't need to repeat it.
      </p>
    </div>
  );
}
