import React, { useState } from 'react';
import useTable from './useTable';
import { apiFetch } from '../api';
import { BytesTag } from '../bytesInfo';

function buildFunderExportQuery(funderIds, yearFrom, yearTo) {
  const ids = funderIds.join(', ');
  return `-- ORION export: works for funder basket
-- Funder IDs: ${ids}
-- Year range: ${yearFrom}–${yearTo}
--
-- This query returns the unique work_ids of all papers that acknowledge
-- funding from the selected funders in the given year range.
-- Use work_id to join with other tables in cwts-leiden.openalex_2025aug.
-- See the Guide tab for instructions and join examples.

SELECT DISTINCT wg.work_id
FROM \`cwts-leiden.openalex_2025aug.work_grant\` wg
JOIN \`cwts-leiden.openalex_2025aug.work\` w ON wg.work_id = w.work_id
WHERE wg.funder_id IN (${ids})
  AND w.pub_year BETWEEN ${yearFrom} AND ${yearTo}
ORDER BY wg.work_id`;
}

function QueryModal({ sql, onClose }) {
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
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '1.2rem', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          <p style={{ fontSize: '.825rem', color: '#64748b', marginBottom: '1rem', lineHeight: 1.6 }}>
            Copy this query and run it in your{' '}
            <a href="https://console.cloud.google.com/bigquery" target="_blank" rel="noreferrer" style={{ color: '#7c8cff' }}>BigQuery console</a>.
            It returns the <code style={{ color: '#a78bfa' }}>work_id</code> of every paper matching your basket.
            See the <strong style={{ color: '#94a3b8' }}>Guide</strong> tab for instructions and join examples.
          </p>
          <pre style={{ background: '#0f1117', border: '1px solid #2d3148', borderRadius: '8px', padding: '1rem', fontSize: '.775rem', color: '#a78bfa', overflowX: 'auto', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {sql}
          </pre>
        </div>
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #2d3148', display: 'flex', gap: '.75rem', justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onClose}>Close</button>
          <button className="btn" onClick={copy}>{copied ? '✓ Copied!' : 'Copy query'}</button>
        </div>
      </div>
    </div>
  );
}

export default function FunderBasket({ basket, removeFromBasket, basketData, setBasketData }) {
  const { results, yearFrom: savedYF, yearTo: savedYT } = basketData;
  const [yearFrom, setYF]         = useState(savedYF);
  const [yearTo, setYT]           = useState(savedYT);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [showQuery, setShowQuery] = useState(false);
  const instTable = useTable(results?.institutions || [], 1000);

  const analyze = () => {
    if (!basket.length) return;
    setLoading(true); setError('');
    apiFetch('/api/basket/funders/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funder_ids: basket.map(b => Number(b.funder_id)), year_from: yearFrom, year_to: yearTo, limit: 1000 }),
    })
      .then(d => { if (d) setBasketData({ results: d, yearFrom, yearTo }); setLoading(false); })
      .catch(e => { setError('Query failed (' + e.message + ')'); setLoading(false); });
  };

  const STh = (tbl, k, label) => (
    <th onClick={() => tbl.onSort(k)} className={tbl.sortKey === k ? 'sorted' : ''}>
      {label}{tbl.sortIcon(k)}
    </th>
  );

  return (
    <div className="page">
      <h1>Funder Basket</h1>
      {basket.length === 0
        ? <div className="status" style={{ marginTop: '3rem' }}>Empty. Go to <strong>Funders</strong> and click <strong>+</strong> on any row.</div>
        : <>
          <div style={{ marginBottom: '1.5rem' }}>
            {basket.map(b => (
              <div key={b.funder_id} className="basket-item">
                <div>
                  <div className="bi-name">{b.name}</div>
                  <div className="bi-meta">{b.country && <span className="badge-country">{b.country}</span>}</div>
                </div>
                <button className="btn danger" style={{ padding: '.25rem .6rem', fontSize: '.75rem' }} onClick={() => removeFromBasket(b.funder_id)}>Remove</button>
              </div>
            ))}
          </div>
          <div className="controls" style={{ marginBottom: '1.5rem' }}>
            <div className="field-group">
              <label>Years</label>
              <input type="number" value={yearFrom} onChange={e => setYF(Number(e.target.value))} />
              <label>to</label>
              <input type="number" value={yearTo} onChange={e => setYT(Number(e.target.value))} />
            </div>
            <button className="btn success" onClick={analyze} disabled={loading}>{loading ? 'Running...' : 'Analyze basket'}</button>
            <button className="btn ghost" onClick={() => setShowQuery(true)}>Get export query</button>
            {results && <BytesTag bytes={results.bytes_processed} />}
          </div>
          {showQuery && (
            <QueryModal
              sql={buildFunderExportQuery(basket.map(b => b.funder_id), yearFrom, yearTo)}
              onClose={() => setShowQuery(false)}
            />
          )}
          {error && <div className="status" style={{ color: '#f87171', marginBottom: '1rem' }}>{error}</div>}
          {results && (
            <>
              <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', marginBottom: '1.5rem' }}>
                <div className="stat-box">
                  <div className="stat-val">{Number(results.total_works).toLocaleString()}</div>
                  <div className="stat-lbl">Total funded works {savedYF}–{savedYT}<br /><small style={{ color: '#334155' }}>No double counting</small></div>
                </div>
                <div className="stat-box">
                  <div className="stat-val">{basket.length}</div>
                  <div className="stat-lbl">Funders</div>
                </div>
              </div>
              <div className="section-title">Top institutions receiving funding from this basket</div>
              <div className="table-wrap">
                <table>
                  <thead><tr>
                    <th>#</th>
                    {STh(instTable, 'name', 'Institution')}
                    {STh(instTable, 'type', 'Type')}
                    {STh(instTable, 'country', 'Country')}
                    {STh(instTable, 'works_count', 'Works')}
                  </tr></thead>
                  <tbody>
                    {instTable.visibleRows.map((inst, i) => (
                      <tr key={i}>
                        <td className="rank">{i + 1}</td>
                        <td>{inst.name}</td>
                        <td>{inst.type ? <span className="badge-type">{inst.type}</span> : '—'}</td>
                        <td>{inst.country ? <span className="badge-country">{inst.country}</span> : '—'}</td>
                        <td className="works">{Number(inst.works_count).toLocaleString()}</td>
                      </tr>
                    ))}
                    {!instTable.visibleRows.length && <tr><td colSpan="5" className="status">None found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      }
    </div>
  );
}

