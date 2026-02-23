import React, { useState } from 'react';
import useTable from './useTable';

export default function InstBasket({ basket, removeFromBasket }) {
  const [yearFrom, setYF]         = useState(2000);
  const [yearTo, setYT]           = useState(2025);
  const [pendingLimit, setPL]     = useState(50);
  const [results, setResults]     = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [listLen, setListLen]     = useState(50);
  const [pendingLen, setPendLen]  = useState(50);
  const funderTable = useTable(results?.funders || [], listLen);
  const collabTable = useTable(results?.collaborators || [], listLen);

  const analyze = () => {
    if (!basket.length) return;
    setLoading(true); setError('');
    fetch('/api/basket/institutions/analyze', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ institution_ids: basket.map(b=>Number(b.institution_id)), year_from:yearFrom, year_to:yearTo, limit:pendingLimit }),
    })
      .then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); })
      .then(d=>{ setResults(d); setLoading(false); })
      .catch(e=>{ setError(`Query failed (${e.message})`); setLoading(false); });
  };

  const STh = (tbl,k,label) => <th onClick={()=>tbl.onSort(k)} className={tbl.sortKey===k?'sorted':''}>{label}{tbl.sortIcon(k)}</th>;

  return (
    <div className="page">
      <h1>🛒 Institution Basket</h1>
      {basket.length===0
        ? <div className="status" style={{marginTop:'3rem'}}>Empty. Go to <strong>Institutions</strong> and click <strong>+</strong> on any row.</div>
        : <>
          <div style={{marginBottom:'1.5rem'}}>
            {basket.map(b=>(
              <div key={b.institution_id} className="basket-item">
                <div>
                  <div className="bi-name">{b.name}</div>
                  <div className="bi-meta">
                    {b.country&&<span className="badge-country" style={{marginRight:'.4rem'}}>{b.country}</span>}
                    {b.type&&<span className="badge-type">{b.type}</span>}
                  </div>
                </div>
                <button className="btn danger" style={{padding:'.25rem .6rem',fontSize:'.75rem'}} onClick={()=>removeFromBasket(b.institution_id)}>Remove</button>
              </div>
            ))}
          </div>
          <div className="controls" style={{marginBottom:'1.5rem'}}>
            <div className="field-group">
              <label>Years</label>
              <input type="number" value={yearFrom} onChange={e=>setYF(Number(e.target.value))}/>
              <label>–</label>
              <input type="number" value={yearTo} onChange={e=>setYT(Number(e.target.value))}/>
            </div>
            <div className="divider"/>
            <div className="field-group">
              <label>Result rows</label>
              <input type="number" value={pendingLimit} onChange={e=>setPL(Number(e.target.value))} style={{width:64}}/>
            </div>
            <button className="btn success" onClick={analyze} disabled={loading}>{loading?'Running…':'▶ Analyze basket'}</button>
            <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:'.5rem'}}>
              <input type="number" value={pendingLen} onChange={e=>setPendLen(Number(e.target.value))} style={{width:64,background:'#0f1117',border:'1px solid #2d3148',borderRadius:6,color:'#e2e8f0',padding:'.5rem .75rem',fontSize:'.9rem',outline:'none'}}/>
              <button className="btn" onClick={()=>setListLen(pendingLen)}>Change list length</button>
            </div>
          </div>
          {error&&<div className="status" style={{color:'#f87171',marginBottom:'1rem'}}>{error}</div>}
          {results&&(
            <>
              <div className="cards" style={{gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))'}}>
                <div className="stat-box">
                  <div className="stat-val">{Number(results.total_works).toLocaleString()}</div>
                  <div className="stat-frac">({Number(results.total_fractional).toLocaleString(undefined,{maximumFractionDigits:1})} frac.)</div>
                  <div className="stat-lbl">Total works {yearFrom}–{yearTo}<br/><small style={{color:'#334155'}}>No double counting</small></div>
                </div>
                <div className="stat-box"><div className="stat-val">{basket.length}</div><div className="stat-lbl">Institutions</div></div>
              </div>
              <div className="results-grid">
                <div>
                  <div className="section-title">Top funders</div>
                  <div className="table-wrap"><table>
                    <thead><tr><th>#</th>{STh(funderTable,'name','Funder')}{STh(funderTable,'country','Country')}{STh(funderTable,'works_count','Works')}</tr></thead>
                    <tbody>
                      {funderTable.visibleRows.map((f,i)=>(
                        <tr key={i}><td className="rank">{i+1}</td><td>{f.name}</td>
                          <td>{f.country?<span className="badge-country">{f.country}</span>:'—'}</td>
                          <td className="works">{Number(f.works_count).toLocaleString()}</td></tr>
                      ))}
                      {!funderTable.visibleRows.length&&<tr><td colSpan="4" className="status">None found.</td></tr>}
                    </tbody>
                  </table></div>
                </div>
                <div>
                  <div className="section-title">Top collaborating institutions</div>
                  <div className="table-wrap"><table>
                    <thead><tr><th>#</th>{STh(collabTable,'name','Institution')}{STh(collabTable,'country','Country')}{STh(collabTable,'works_count','Co-authored')}</tr></thead>
                    <tbody>
                      {collabTable.visibleRows.map((c,i)=>(
                        <tr key={i}><td className="rank">{i+1}</td><td>{c.name}</td>
                          <td>{c.country?<span className="badge-country">{c.country}</span>:'—'}</td>
                          <td className="works">{Number(c.works_count).toLocaleString()}</td></tr>
                      ))}
                      {!collabTable.visibleRows.length&&<tr><td colSpan="4" className="status">None found.</td></tr>}
                    </tbody>
                  </table></div>
                </div>
              </div>
            </>
          )}
        </>
      }
    </div>
  );
}
