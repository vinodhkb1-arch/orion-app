/**
 * BasketPage — generic basket component used for both institution and funder baskets.
 *
 * Config props differ between the two modes:
 *   type          'institutions' | 'funders'
 *   idKey         field name for the entity's ID (e.g. 'institution_id')
 *   apiBase       URL prefix for basket API calls (e.g. '/api/basket/institutions')
 *   queryBuilders { works, coInst, coFund } — SQL export builders from BasketShared
 *   title         Page heading
 *   emptyHint     Message shown when basket is empty
 */
import React, { useState } from 'react';
import { apiFetch } from '../api';
import { BytesTag } from '../bytesInfo';
import { QueryModal, ResultTable } from './BasketShared';

export default function BasketPage({
  basket,
  removeFromBasket,
  basketData,
  setBasketData,
  addInstToBasket,
  addFunderToBasket,
  // config
  type,
  idKey,
  apiBase,
  queryBuilders,
  title,
  emptyHint,
}) {
  const { yearFrom: savedYF, yearTo: savedYT, worksResult, coInstResult, coFundResult } = basketData;
  const [yearFrom, setYF] = useState(savedYF);
  const [yearTo,   setYT] = useState(savedYT);

  const [worksLoading,  setWorksLoading]  = useState(false);
  const [coInstLoading, setCoInstLoading] = useState(false);
  const [coFundLoading, setCoFundLoading] = useState(false);

  const [worksQuery,  setWorksQuery]  = useState(false);
  const [coInstQuery, setCoInstQuery] = useState(false);
  const [coFundQuery, setCoFundQuery] = useState(false);

  const [error, setError] = useState('');

  // Persist results + the year range that was actually used, so labels stay in sync.
  const setWorksResult  = (r, yf, yt) => setBasketData(d => ({ ...d, worksResult: r,  worksYF: yf,  worksYT: yt  }));
  const setCoInstResult = (r, yf, yt) => setBasketData(d => ({ ...d, coInstResult: r, coInstYF: yf, coInstYT: yt }));
  const setCoFundResult = (r, yf, yt) => setBasketData(d => ({ ...d, coFundResult: r, coFundYF: yf, coFundYT: yt }));

  // Also persist the year inputs so they survive tab switches.
  const applyYF = v => { setYF(v); setBasketData(d => ({ ...d, yearFrom: v })); };
  const applyYT = v => { setYT(v); setBasketData(d => ({ ...d, yearTo: v   })); };

  const ids = basket.map(b => Number(b[idKey]));

  const body = (yf, yt) => JSON.stringify({
    [`${type === 'institutions' ? 'institution' : 'funder'}_ids`]: ids,
    year_from: yf,
    year_to: yt,
    limit: 1000,
  });

  const postOpts = (yf, yt) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body(yf, yt),
  });

  const getWorks = () => {
    const yf = yearFrom, yt = yearTo;
    setWorksLoading(true); setError('');
    apiFetch(`${apiBase}/works`, postOpts(yf, yt))
      .then(d => { if (d) setWorksResult(d, yf, yt); })
      .catch(e => setError(e.message))
      .finally(() => setWorksLoading(false));
  };

  const getCoInst = () => {
    const yf = yearFrom, yt = yearTo;
    setCoInstLoading(true); setError('');
    apiFetch(`${apiBase}/co-institutions`, postOpts(yf, yt))
      .then(d => { if (d) setCoInstResult(d, yf, yt); })
      .catch(e => setError(e.message))
      .finally(() => setCoInstLoading(false));
  };

  const getCoFund = () => {
    const yf = yearFrom, yt = yearTo;
    setCoFundLoading(true); setError('');
    apiFetch(`${apiBase}/co-funders`, postOpts(yf, yt))
      .then(d => { if (d) setCoFundResult(d, yf, yt); })
      .catch(e => setError(e.message))
      .finally(() => setCoFundLoading(false));
  };

  // Read back the year range that was actually used for each result.
  const wYF = basketData.worksYF  ?? yearFrom;
  const wYT = basketData.worksYT  ?? yearTo;

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
      <h1>{title}</h1>
      {basket.length === 0
        ? <div className="status" style={{ marginTop: '3rem' }}>{emptyHint}</div>
        : <>
          {/* Basket items */}
          <div style={{ marginBottom: '1.5rem' }}>
            {basket.map(b => (
              <div key={b[idKey]} className="basket-item">
                <div>
                  <div className="bi-name">{b.name}</div>
                  <div className="bi-meta">
                    {b.country && <span className="badge-country" style={{ marginRight: '.4rem' }}>{b.country}</span>}
                    {b.type    && <span className="badge-type">{b.type}</span>}
                  </div>
                </div>
                <button className="btn danger" style={{ padding: '.25rem .6rem', fontSize: '.75rem' }} onClick={() => removeFromBasket(b[idKey])}>Remove</button>
              </div>
            ))}
          </div>

          {/* Year controls */}
          <div className="controls" style={{ marginBottom: '1rem' }}>
            <div className="field-group">
              <label>Years</label>
              <input type="number" value={yearFrom} onChange={e => applyYF(Number(e.target.value))} />
              <label>to</label>
              <input type="number" value={yearTo}   onChange={e => applyYT(Number(e.target.value))} />
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {actionBtn('Get all works',                getWorks,  worksLoading)}
            {actionBtn('Get co-occurring institutions', getCoInst, coInstLoading)}
            {actionBtn('Get co-occurring funders',      getCoFund, coFundLoading)}
          </div>

          {error && <div className="status" style={{ color: '#f87171', marginBottom: '1rem' }}>{error}</div>}

          {/* Works result */}
          {worksResult && worksResult.total_works > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '.75rem', flexWrap: 'wrap' }}>
                <div className="section-title" style={{ margin: 0 }}>All works</div>
                <BytesTag bytes={worksResult.bytes_processed} />
                <button className="btn ghost" style={{ marginLeft: 'auto' }} onClick={() => setWorksQuery(true)}>Get export query</button>
              </div>
              <div className="stat-box" style={{ display: 'inline-block', minWidth: '200px' }}>
                <div className="stat-val">{Number(worksResult.total_works).toLocaleString()}</div>
                <div className="stat-lbl">
                  Total works {wYF}–{wYT}<br />
                  <small style={{ color: '#334155' }}>No double counting</small>
                </div>
              </div>
            </div>
          )}
          {worksResult && worksResult.total_works === 0 && (
            <div className="status" style={{ marginBottom: '2rem' }}>No works found for this basket in {wYF}–{wYT}.</div>
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

          {worksQuery  && <QueryModal sql={queryBuilders.works(ids, wYF, wYT)}    onClose={() => setWorksQuery(false)} />}
          {coInstQuery && <QueryModal sql={queryBuilders.coInst(ids, basketData.coInstYF ?? yearFrom, basketData.coInstYT ?? yearTo)} onClose={() => setCoInstQuery(false)} />}
          {coFundQuery && <QueryModal sql={queryBuilders.coFund(ids, basketData.coFundYF ?? yearFrom, basketData.coFundYT ?? yearTo)} onClose={() => setCoFundQuery(false)} />}
        </>
      }
    </div>
  );
}
