import React, { useState } from 'react';
import useTable from './useTable';

export default function InstBasket({ basket, removeFromBasket, basketData, setBasketData }) {
  const { results, yearFrom: savedYF, yearTo: savedYT } = basketData;
  const [yearFrom, setYF]     = useState(savedYF);
  const [yearTo, setYT]       = useState(savedYT);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const funderTable = useTable(results?.funders || [], 1000);
  const collabTable = useTable(results?.collaborators || [], 1000);

  const analyze = () => {
    if (!basket.length) return;
    setLoading(true); setError('');
    fetch('/api/basket/institutions/analyze', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ institution_ids: basket.map(b=>Number(b.institution_id)), year_from:yearFrom, year_to:yearTo, limit:1000 }),
    })
      .then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); })
      .then(d=>{ setBasketData({ results: d, yearFrom, yearTo }); setLoading(false); })
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
            <button className="btn success" onClick={analyze} disabled={loading}>{loading?'Running…':'▶ Analyze basket'}</button>
          </div>
          {error&&<div className="status" style={{color:'#f87171',marginBottom:'1rem'}}>{error}</div>}
          {results&&(
            <>
              <div className="cards" style={{gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))'}}>
                <div className="stat-box">
                  <div className="stat-val">{Number(results.total_works).toLocaleString()}</div>
                  <div className="stat-frac">({Number(results.total_fractional).toLocaleString(undefined,{maximumFractionDigits:1})} frac.)</div>
                  <div className="stat-lbl">Total works {savedYF}–{savedYT}<br/><small style={{color:'#334155'}}>No double counting</small></div>
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
            <button className="btn success" onClick={analyze} disabled={loading}>{loading?'Running…':'▶ Analyze basket'}</button>
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
