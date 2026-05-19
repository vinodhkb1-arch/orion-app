import React, { useState } from 'react';
import { apiFetch, exportCsv } from '../api';
import { QueryModal } from './BasketShared';
import {
  buildDirectCitationQuery,
  buildCoCitationQuery,
  buildDirectReferenceQuery,
  buildBibliographicCouplingQuery,
} from './queryBuilders';

const DISPLAY_LIMIT = 1000;

const TABLE_CONFIGS = [
  {
    key: 'directCitation',
    label: 'Direct Citation',
    desc: 'Papers that cite your seeds',
    scoreLabel: 'Seeds cited',
    endpoint: '/api/lab/direct-citations',
    buildQuery: buildDirectCitationQuery,
  },
  {
    key: 'coCitation',
    label: 'Co-citation',
    desc: 'Papers cited alongside your seeds (Janssens & Gwinn 2015)',
    scoreLabel: 'Co-citation freq',
    endpoint: '/api/lab/co-citations',
    buildQuery: buildCoCitationQuery,
  },
  {
    key: 'directReference',
    label: 'Direct Reference',
    desc: "Papers in your seeds' bibliography",
    scoreLabel: 'Referenced by seeds',
    endpoint: '/api/lab/direct-references',
    buildQuery: buildDirectReferenceQuery,
  },
  {
    key: 'bibCoupling',
    label: 'Bibliographic Coupling',
    desc: 'Papers sharing references with your seeds',
    scoreLabel: 'Shared refs',
    endpoint: '/api/lab/bibliographic-coupling',
    buildQuery: buildBibliographicCouplingQuery,
  },
];

function parseIds(input) {
  return [...new Set(
    input.split(/[\s,\n]+/)
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n > 0)
  )];
}

function CitationTable({ config, state, workIds, onRun }) {
  const [queryModalSql, setQueryModalSql] = useState(null);
  const { rows, loading, error } = state;
  const displayRows = rows ? rows.slice(0, DISPLAY_LIMIT) : null;

  return (
    <div style={{ background: '#1a1d27', border: '1px solid #2d3148', borderRadius: '10px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '.75rem' }}>
        <div>
          <div style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '.9rem' }}>{config.label}</div>
          <div style={{ fontSize: '.73rem', color: '#475569', marginTop: '.2rem' }}>{config.desc}</div>
        </div>
        <button
          className="btn"
          style={{ fontSize: '.8rem', flexShrink: 0 }}
          onClick={onRun}
          disabled={loading || workIds.length === 0}
        >
          {loading ? 'Running…' : 'Run'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#2d1515', border: '1px solid #7f1d1d', borderRadius: '6px', padding: '.65rem .85rem', fontSize: '.78rem', color: '#f87171', lineHeight: 1.5 }}>
          {error}
        </div>
      )}

      {!displayRows && !loading && !error && (
        <div style={{ color: '#2d3148', fontSize: '.8rem', textAlign: 'center', padding: '1.5rem 0' }}>
          —
        </div>
      )}

      {displayRows && (
        <>
          <div style={{ fontSize: '.72rem', color: '#475569', display: 'flex', gap: '1rem' }}>
            <span>
              {rows.length >= DISPLAY_LIMIT
                ? `Top ${DISPLAY_LIMIT.toLocaleString()} results`
                : `${rows.length.toLocaleString()} result${rows.length !== 1 ? 's' : ''}`}
            </span>
            {state.bytesProcessed != null && (
              <span>{(state.bytesProcessed / 1e9).toFixed(2)} GB billed</span>
            )}
          </div>
          <div className="table-wrap" style={{ maxHeight: '380px', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Work ID</th>
                  <th>Title</th>
                  <th>Year</th>
                  <th>{config.scoreLabel}</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((r, i) => (
                  <tr key={r.work_id ?? i}>
                    <td className="rank">{i + 1}</td>
                    <td style={{ fontSize: '.73rem', fontVariantNumeric: 'tabular-nums' }}>
                      <a
                        href={`https://openalex.org/works/w${r.work_id}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#7c8cff' }}
                        onClick={e => e.stopPropagation()}
                      >
                        {r.work_id}
                      </a>
                    </td>
                    <td style={{ maxWidth: '280px', fontSize: '.8rem', lineHeight: 1.4, color: r.title ? '#cbd5e1' : '#334155' }}>
                      {r.title ?? '—'}
                    </td>
                    <td style={{ color: '#64748b', fontSize: '.8rem' }}>{r.pub_year ?? '—'}</td>
                    <td className="works">{Number(r.score).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
            <button className="btn ghost" style={{ fontSize: '.72rem' }} onClick={() => exportCsv(rows, `${config.key}.csv`)}>
              Download CSV
            </button>
            <button className="btn ghost" style={{ fontSize: '.72rem' }} onClick={() => setQueryModalSql(config.buildQuery(workIds))}>
              Export query
            </button>
          </div>
        </>
      )}

      {queryModalSql && <QueryModal sql={queryModalSql} onClose={() => setQueryModalSql(null)} />}
    </div>
  );
}

const emptyState = () => ({ rows: null, loading: false, error: null, bytesProcessed: null });

export default function Lab({ projectId }) {
  const [rawInput, setRawInput] = useState('');
  const [tableStates, setTableStates] = useState(
    Object.fromEntries(TABLE_CONFIGS.map(t => [t.key, emptyState()]))
  );

  const workIds = parseIds(rawInput);

  const handleRun = async (config) => {
    if (!workIds.length) return;
    setTableStates(s => ({ ...s, [config.key]: { rows: null, loading: true, error: null, bytesProcessed: null } }));
    try {
      const data = await apiFetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ work_ids: workIds }),
      });
      setTableStates(s => ({ ...s, [config.key]: { rows: data.rows, loading: false, error: null, bytesProcessed: data.bytes_processed } }));
    } catch (e) {
      setTableStates(s => ({ ...s, [config.key]: { rows: null, loading: false, error: e.message, bytesProcessed: null } }));
    }
  };

  return (
    <div className="page">
      <div style={{ background: '#1c1600', border: '1px solid #78350f', borderRadius: '8px', padding: '.7rem 1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '.65rem', fontSize: '.8rem', color: '#92400e' }}>
        <span>⚗️</span>
        <span><strong style={{ color: '#d97706' }}>Lab — experimental</strong> · Queries and UI are unpolished and subject to change.</span>
      </div>

      <div style={{ background: '#1a1d27', border: '1px solid #2d3148', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '.9rem', marginBottom: '.4rem' }}>Seed papers</div>
        <div style={{ fontSize: '.75rem', color: '#64748b', marginBottom: '.75rem' }}>
          OpenAlex integer work IDs (e.g. <code style={{ color: '#94a3b8' }}>2150220236</code>). One per line or comma-separated.
        </div>
        <textarea
          value={rawInput}
          onChange={e => setRawInput(e.target.value)}
          placeholder={'2150220236\n2755950973'}
          rows={4}
          style={{ width: '100%', background: '#0f1117', border: '1px solid #2d3148', borderRadius: '6px', color: '#e2e8f0', fontSize: '.85rem', padding: '.65rem .85rem', resize: 'vertical', fontFamily: 'monospace', boxSizing: 'border-box', outline: 'none' }}
        />
        {workIds.length > 0 && (
          <div style={{ fontSize: '.72rem', color: '#475569', marginTop: '.4rem' }}>
            {workIds.length} ID{workIds.length !== 1 ? 's' : ''} parsed
            {workIds.length <= 5 ? ': ' + workIds.join(', ') : ': ' + workIds.slice(0, 5).join(', ') + ` … +${workIds.length - 5} more`}
          </div>
        )}
      </div>

      <div className="results-grid">
        {TABLE_CONFIGS.map(config => (
          <CitationTable
            key={config.key}
            config={config}
            state={tableStates[config.key]}
            workIds={workIds}
            onRun={() => handleRun(config)}
          />
        ))}
      </div>
    </div>
  );
}
