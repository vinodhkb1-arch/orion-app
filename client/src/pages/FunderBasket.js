import React, { useState } from 'react';
import useTable from './useTable';
import { apiFetch } from '../api';
import { BytesTag } from '../bytesInfo';

const SRC = 'cwts-leiden.openalex_2025aug';

function buildWorksQuery(ids, yf, yt) {
  return `-- ORION export: all works for funder basket
-- Funder IDs: ${ids.join(', ')}
-- Year range: ${yf}–${yt}
--
-- Returns the unique work_id of every paper that acknowledges
-- funding from the selected funders in the given year range.
-- See the Guide tab for instructions and join examples.

SELECT DISTINCT wg.work_id
FROM \`${SRC}.work_grant\` wg
JOIN \`${SRC}.work\` w ON wg.work_id = w.work_id
WHERE wg.funder_id IN (${ids.join(', ')})
  AND w.pub_year BETWEEN ${yf} AND ${yt}
ORDER BY wg.work_id`;
}

function buildCoInstQuery(ids, yf, yt) {
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
FROM \`${SRC}.work_grant\` wg
JOIN \`${SRC}.work\` w ON wg.work_id = w.work_id
JOIN \`${SRC}.work_affiliation_institution\` wai ON w.work_id = wai.work_id
JOIN \`${SRC}.institution\` i ON wai.institution_id = i.institution_id
LEFT JOIN \`${SRC}.institution_type\` it ON i.institution_type_id = it.institution_type_id
WHERE wg.funder_id IN (${ids.join(', ')})
  AND w.pub_year BETWEEN ${yf} AND ${yt}
GROUP BY i.institution_id, i.institution, i.country_iso_alpha2_code, it.institution_type
ORDER BY works_count DESC`;
}

function buildCoFunderQuery(ids, yf, yt) {
  return `-- ORION export: co-occurring funders for funder basket
-- Funder IDs: ${ids.join(', ')}
-- Year range: ${yf}–${yt}
--
-- Returns other funders that co-funded the same papers as
-- the basket funders, ranked by co-occurrence count.

SELECT f.funder_id, f.funder AS name,
       f.country_iso_alpha2_code AS country,
       COUNT(DISTINCT wg2.work_id) AS works_count
FROM \`${SRC}.work_grant\` wg
JOIN \`${SRC}.work\` w ON wg.work_id = w.work_id
JOIN \`${SRC}.work_grant\` wg2
    ON wg.work_id = wg2.work_id
   AND wg2.funder_id NOT IN (${ids.join(', ')})
JOIN \`${SRC}.funder\` f ON wg2.funder_id = f.funder_id
WHERE wg.funder_id IN (${ids.join(', ')})
  AND w.pub_year BETWEEN ${yf} AND ${yt}
GROUP BY f.funder_id, f.funder, f.country_iso_alpha2_code
ORDER BY works_count DESC`;
}

function QueryModal({ sql, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(sql); setCopied(true); setTimeout(() => setCopied(false), 2000); };
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

function ResultTable({ rows, type, addToBasket, loading }) {
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

export default function FunderBasket({ basket, removeFromBasket, basketData, setBasketData, addInstToBasket, addFunderToBasket }) {
  const { yearFrom: savedYF, yearTo: savedYT } = basketData;
  const [yearFrom, setYF] = useState(savedYF);
  const [yearTo, setYT]   = useState(savedYT);

  const [worksResult,   setWorksResult]   = useState(null);
  const [coInstResult,  setCoInstResult]  = useState(null);
  const [coFundResult,  setCoFundResult]  = useState(null);

  const [worksLoading,  setWorksLoading]  = useState(false);
  const [coInstLoading, setCoInstLoading] = useState(false);
  const [coFundLoading, setCoFundLoading] = useState(false);

  const [worksQuery,   setWorksQuery]   = useState(false);
  const [coInstQuery,  setCoInstQuery]  = useState(false);
  const [coFundQuery,  setCoFundQuery]  = useState(false);

  const [error, setError] = useState('');

  const body = () => JSON.stringify({
    funder_ids: basket.map(b => Number(b.funder_id)),
    year_from: yearFrom, year_to: yearTo, limit: 1000,
  });

  const getWorks = () => {
    setWorksLoading(true); setError('');
    apiFetch('/api/basket/funders/works', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body() })
      .then(d => { if (d) setWorksResult(d); setWorksLoading(false); })
      .catch(e => { setError(e.message); setWorksLoading(false); });
  };

  const getCoInst = () => {
    setCoInstLoading(true); setError('');
    apiFetch('/api/basket/funders/co-institutions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body() })
      .then(d => { if (d) setCoInstResult(d); setCoInstLoading(false); })
      .catch(e => { setError(e.message); setCoInstLoading(false); });
  };

  const getCoFund = () => {
    setCoFundLoading(true); setError('');
    apiFetch('/api/basket/funders/co-funders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body() })
      .then(d => { if (d) setCoFundResult(d); setCoFundLoading(false); })
      .catch(e => { setError(e.message); setCoFundLoading(false); });
  };

  const ids = basket.map(b => b.funder_id);

  const actionBtn = (label, onClick, loading) => (
    <button
      className="btn"
      onClick={onClick}
      disabled={loading}
      style={{ flex: 1, justifyContent: 'center', opacity: loading ? .6 : 1 }}
    >
      {loading ? 'Running…' : label}
    </button>
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

          <div className="controls" style={{ marginBottom: '1rem' }}>
            <div className="field-group">
              <label>Years</label>
              <input type="number" value={yearFrom} onChange={e => setYF(Number(e.target.value))} />
              <label>to</label>
              <input type="number" value={yearTo} onChange={e => setYT(Number(e.target.value))} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {actionBtn('Get all works', getWorks, worksLoading)}
            {actionBtn('Get co-occurring institutions', getCoInst, coInstLoading)}
            {actionBtn('Get co-occurring funders', getCoFund, coFundLoading)}
          </div>

          {error && <div className="status" style={{ color: '#f87171', marginBottom: '1rem' }}>{error}</div>}

          {/* Works result */}
          {worksResult && (
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '.75rem', flexWrap: 'wrap' }}>
                <div className="section-title" style={{ margin: 0 }}>All works</div>
                <BytesTag bytes={worksResult.bytes_processed} />
                <button className="btn ghost" style={{ marginLeft: 'auto' }} onClick={() => setWorksQuery(true)}>Get export query</button>
              </div>
              <div className="stat-box" style={{ display: 'inline-block', minWidth: '200px' }}>
                <div className="stat-val">{Number(worksResult.total_works).toLocaleString()}</div>
                <div className="stat-lbl">Total works {yearFrom}–{yearTo}<br /><small style={{ color: '#334155' }}>No double counting</small></div>
              </div>
            </div>
          )}

          {/* Co-institutions result */}
          {(coInstResult || coInstLoading) && (
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '.75rem', flexWrap: 'wrap' }}>
                <div className="section-title" style={{ margin: 0 }}>Co-occurring institutions</div>
                {coInstResult && <BytesTag bytes={coInstResult.bytes_processed} />}
                {coInstResult && <button className="btn ghost" style={{ marginLeft: 'auto' }} onClick={() => setCoInstQuery(true)}>Get export query</button>}
              </div>
              <ResultTable
                rows={coInstResult?.rows || []}
                type="institutions"
                addToBasket={addInstToBasket}
                loading={coInstLoading}
              />
            </div>
          )}

          {/* Co-funders result */}
          {(coFundResult || coFundLoading) && (
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '.75rem', flexWrap: 'wrap' }}>
                <div className="section-title" style={{ margin: 0 }}>Co-occurring funders</div>
                {coFundResult && <BytesTag bytes={coFundResult.bytes_processed} />}
                {coFundResult && <button className="btn ghost" style={{ marginLeft: 'auto' }} onClick={() => setCoFundQuery(true)}>Get export query</button>}
              </div>
              <ResultTable
                rows={coFundResult?.rows || []}
                type="funders"
                addToBasket={addFunderToBasket}
                loading={coFundLoading}
              />
            </div>
          )}

          {worksQuery  && <QueryModal sql={buildWorksQuery(ids, yearFrom, yearTo)}    onClose={() => setWorksQuery(false)} />}
          {coInstQuery && <QueryModal sql={buildCoInstQuery(ids, yearFrom, yearTo)}   onClose={() => setCoInstQuery(false)} />}
          {coFundQuery && <QueryModal sql={buildCoFunderQuery(ids, yearFrom, yearTo)} onClose={() => setCoFundQuery(false)} />}
        </>
      }
    </div>
  );
}
