import React, { useState } from 'react';

const FIELD = {
  author_name:   'Author',
  total_papers:  'Papers',
  CARP_total:    'CARP Total',
  CARP_avg:      'CARP Avg',
  avg_FN:        'Avg FN',
  avg_W:         'Avg W',
  top_fields:    'Top Fields',
};

export default function CarpPage({ basket, projectId }) {
  const [yearFrom,   setYearFrom]   = useState(2015);
  const [yearTo,     setYearTo]     = useState(2024);
  const [minPapers,  setMinPapers]  = useState(3);
  const [limit,      setLimit]      = useState(100);
  const [result,     setResult]     = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [sortCol,    setSortCol]    = useState('CARP_total');
  const [sortAsc,    setSortAsc]    = useState(false);

  const ids = basket.map(b => b.institution_id);

  const run = async () => {
    if (!ids.length) { setError('Add institutions to the basket first.'); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch('/api/carp/institutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institution_ids: ids,
          year_from: yearFrom,
          year_to:   yearTo,
          min_papers: minPapers,
          limit,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const sorted = result?.rows ? [...result.rows].sort((a, b) => {
    const av = a[sortCol] ?? '';
    const bv = b[sortCol] ?? '';
    return sortAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  }) : [];

  const handleSort = col => {
    if (col === sortCol) setSortAsc(a => !a);
    else { setSortCol(col); setSortAsc(false); }
  };

  const mbGb = bytes => {
    if (!bytes) return '';
    if (bytes > 1e9) return `${(bytes/1e9).toFixed(2)} GB`;
    return `${(bytes/1e6).toFixed(1)} MB`;
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ color: '#e2e8f0', margin: 0 }}>
          ⭐ CARP — Contribution-Adjusted Research Performance
        </h2>
        <p style={{ color: '#64748b', fontSize: '.85rem', marginTop: '.4rem' }}>
          Author-level scores for institutions in your basket.
          Formula: <code style={{ color: '#94a3b8' }}>CARP(a,p) = W(a,n) × FN(p) × FW(f) × CR(a)</code>
        </p>
        <p style={{ color: '#475569', fontSize: '.75rem', marginTop: '.2rem' }}>
          Reference: Kumar, V. (2026). CARP Metric Specification v1.0. Zenodo.{' '}
          <a href="https://doi.org/10.5281/zenodo.20588564" target="_blank" rel="noreferrer"
             style={{ color: '#6366f1' }}>doi:10.5281/zenodo.20588564</a>
        </p>
      </div>

      {/* Basket summary */}
      <div style={{ background: '#1e293b', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ color: '#94a3b8', fontSize: '.8rem', marginBottom: '.5rem' }}>
          Institution basket ({ids.length} institution{ids.length !== 1 ? 's' : ''})
        </div>
        {ids.length === 0
          ? <span style={{ color: '#475569', fontSize: '.85rem' }}>No institutions in basket. Go to Search → Institutions and click + on any row.</span>
          : <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
              {basket.map(b => (
                <span key={b.institution_id} style={{
                  background: '#334155', color: '#cbd5e1', fontSize: '.75rem',
                  padding: '.2rem .6rem', borderRadius: '4px'
                }}>
                  {b.name} <span style={{ color: '#64748b' }}>{b.country}</span>
                </span>
              ))}
            </div>
        }
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
        {[
          { label: 'Year from', val: yearFrom, set: v => setYearFrom(+v), min: 2000, max: 2024 },
          { label: 'Year to',   val: yearTo,   set: v => setYearTo(+v),   min: 2000, max: 2024 },
          { label: 'Min papers', val: minPapers, set: v => setMinPapers(+v), min: 1, max: 50 },
          { label: 'Top N authors', val: limit, set: v => setLimit(+v), min: 10, max: 500 },
        ].map(({ label, val, set, min, max }) => (
          <div key={label}>
            <div style={{ color: '#64748b', fontSize: '.75rem', marginBottom: '.25rem' }}>{label}</div>
            <input
              type="number" value={val} min={min} max={max}
              onChange={e => set(e.target.value)}
              style={{
                background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0',
                padding: '.4rem .6rem', borderRadius: '6px', width: '90px', fontSize: '.85rem'
              }}
            />
          </div>
        ))}

        <button
          onClick={run}
          disabled={loading || ids.length === 0}
          style={{
            background: loading ? '#334155' : '#6366f1',
            color: '#fff', border: 'none', borderRadius: '6px',
            padding: '.5rem 1.4rem', cursor: loading ? 'default' : 'pointer',
            fontSize: '.85rem', fontWeight: 600
          }}
        >
          {loading ? 'Running…' : 'Run CARP'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#450a0a', color: '#fca5a5', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '.85rem' }}>
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {[
              { label: 'Authors found', val: result.rows.length },
              { label: 'Data processed', val: mbGb(result.bytes_processed) },
              { label: 'Year range', val: `${yearFrom}–${yearTo}` },
            ].map(({ label, val }) => (
              <div key={label} style={{ background: '#1e293b', padding: '.75rem 1.2rem', borderRadius: '8px' }}>
                <div style={{ color: '#64748b', fontSize: '.7rem', marginBottom: '.2rem' }}>{label}</div>
                <div style={{ color: '#e2e8f0', fontSize: '1.1rem', fontWeight: 600 }}>{val}</div>
              </div>
            ))}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' }}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  {Object.entries(FIELD).map(([col, label]) => (
                    <th key={col} style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSort(col)}>
                      {label} {sortCol === col ? (sortAsc ? '↑' : '↓') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row, i) => (
                  <tr key={row.author_id ?? i}
                      style={{ background: i % 2 === 0 ? '#0f172a' : '#1e293b' }}>
                    <td style={tdStyle}>{i + 1}</td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: '#e2e8f0' }}>{row.author_name || '—'}</td>
                    <td style={tdStyle}>{row.total_papers}</td>
                    <td style={{ ...tdStyle, color: '#6366f1', fontWeight: 600 }}>{row.CARP_total}</td>
                    <td style={tdStyle}>{row.CARP_avg}</td>
                    <td style={tdStyle}>{row.avg_FN}</td>
                    <td style={tdStyle}>{row.avg_W}</td>
                    <td style={{ ...tdStyle, color: '#64748b', fontSize: '.75rem' }}>{row.top_fields || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const thStyle = {
  background: '#1e293b', color: '#94a3b8', padding: '.6rem .8rem',
  textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #334155',
  whiteSpace: 'nowrap',
};
const tdStyle = {
  color: '#cbd5e1', padding: '.5rem .8rem',
  borderBottom: '1px solid #1e293b', whiteSpace: 'nowrap',
};
