import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import useTable from './useTable';

const FIELDS = [{value:'name',label:'Name'},{value:'country',label:'Country (ISO)'},{value:'description',label:'Description'}];

export default function Funders({ funderData, setFunderData, basket, addToBasket }) {
  const { rows, yearFrom: fetchedYF, yearTo: fetchedYT } = funderData;
  const [loading, setLoading]   = useState(false);
  const [q, setQ]               = useState('');
  const [field, setField]       = useState('name');
  const [yearFrom, setYF]       = useState(fetchedYF);
  const [yearTo, setYT]         = useState(fetchedYT);
  const [sel, setSel]           = useState(null);
  const [trends, setTrends]     = useState([]);
  const [tl, setTl]             = useState(false);
  const { visibleRows, onSort, sortIcon, sortKey } = useTable(rows, 1000);

  const fetchData = (yf, yt, sq, sf) => {
    setLoading(true);
    const url = sq.trim()
      ? `/api/funders/search?q=${encodeURIComponent(sq)}&field=${sf}&year_from=${yf}&year_to=${yt}&limit=1000`
      : `/api/funders/top?year_from=${yf}&year_to=${yt}&limit=1000`;
    fetch(url).then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); })
      .then(d=>{ setFunderData({rows:d,yearFrom:yf,yearTo:yt}); setLoading(false); })
      .catch(()=>{ setFunderData({rows:[],yearFrom:yf,yearTo:yt}); setLoading(false); });
  };

  const apply = () => fetchData(yearFrom, yearTo, q, field);
  const reset = () => { setQ('');setField('name');setYF(2020);setYT(2025);setFunderData({rows:[],yearFrom:2020,yearTo:2025});setSel(null);setTrends([]); };

  const pick = row => {
    if (sel?.funder_id===row.funder_id) { setSel(null);setTrends([]);return; }
    setSel(row); setTl(true);
    fetch(`/api/funders/${row.funder_id}/trends`)
      .then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); })
      .then(d=>{ setTrends(d); setTl(false); })
      .catch(()=>setTl(false));
  };

  const inBasket = id => basket.some(b=>b.funder_id===id);
  const filteredTrends = trends.filter(t => t.year >= fetchedYF && t.year <= fetchedYT);

  const SortTh = ({k,children}) => (
    <th onClick={()=>onSort(k)} className={sortKey===k?'sorted':''}>{children}{sortIcon(k)}</th>
  );

  return (
    <div className="page">
      <h1>Funders</h1>
      <div className="controls">
        <div className="field-group">
          <label>Search by</label>
          <select value={field} onChange={e=>setField(e.target.value)}>
            {FIELDS.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <input type="text" placeholder={`Search by ${FIELDS.find(f=>f.value===field)?.label}…`}
          value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&apply()}/>
        <div className="divider"/>
        <div className="field-group">
          <label>Years</label>
          <input type="number" value={yearFrom} onChange={e=>setYF(Number(e.target.value))}/>
          <label>–</label>
          <input type="number" value={yearTo} onChange={e=>setYT(Number(e.target.value))}/>
        </div>
        <button className="btn" onClick={apply}>Search</button>
      </div>

      <div className="split-layout">
        <div>
          {loading && <div className="status">Loading…</div>}
          {!loading && rows.length===0 && <div className="status">Use the controls above and click Search to load data.</div>}
          {!loading && rows.length>0 && (
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th>#</th><th></th>
                  <SortTh k="name">Funder</SortTh>
                  <SortTh k="country">Country</SortTh>
                  <th>Description</th>
                  <SortTh k="works_count">Works</SortTh>
                  <th></th>
                </tr></thead>
                <tbody>
                  {visibleRows.map((r,i)=>(
                    <tr key={r.funder_id} onClick={()=>pick(r)}
                      className={sel?.funder_id===r.funder_id?'selected':inBasket(r.funder_id)?'in-basket':''}>
                      <td className="rank">{i+1}</td>
                      <td>{r.thumbnail_url?<img className="thumb" src={r.thumbnail_url} alt=""/>:<div className="thumb"/>}</td>
                      <td>{r.name}</td>
                      <td>{r.country?<span className="badge-country">{r.country}</span>:'—'}</td>
                      <td className="desc">{r.description||'—'}</td>
                      <td className="works">{Number(r.works_count).toLocaleString()}</td>
                      <td onClick={e=>e.stopPropagation()}>
                        {inBasket(r.funder_id)
                          ? <span style={{color:'#4ade80',fontSize:'.8rem'}}>✓</span>
                          : <button className="btn secondary" style={{padding:'.2rem .5rem',fontSize:'.75rem'}} onClick={()=>addToBasket(r)}>+</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="tbl-footer">
                <span>Showing {visibleRows.length} of {rows.length} results</span>
              </div>
            </div>
          )}
        </div>

        <div className="chart-panel">
          <div className="panel-title">
            {sel
              ? <>{sel.name}{sel.openalex_id&&<a href={`https://openalex.org/${sel.openalex_id}`} target="_blank" rel="noreferrer" style={{marginLeft:'.5rem',color:'#7c8cff',fontSize:'.75rem'}}>↗</a>}</>
              : '📈 Click a row to see trends'}
          </div>
          {!sel && <div className="panel-hint">Select a funder from the table</div>}
          {sel && tl && <div className="panel-hint">Loading…</div>}
          {sel && !tl && filteredTrends.length===0 && <div className="panel-hint">No data for {fetchedYF}–{fetchedYT}</div>}
          {sel && !tl && filteredTrends.length>0 && (
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={filteredTrends} margin={{top:4,right:8,bottom:4,left:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3148"/>
                <XAxis dataKey="year" stroke="#475569" tick={{fontSize:10}}
                  domain={[fetchedYF, fetchedYT]} type="number" allowDataOverflow/>
                <YAxis stroke="#475569" tick={{fontSize:10}} width={45}/>
                <Tooltip contentStyle={{background:'#1a1d27',border:'1px solid #2d3148',borderRadius:6}} labelStyle={{color:'#94a3b8'}} itemStyle={{color:'#4ade80'}}/>
                <Line type="monotone" dataKey="works" name="Works" stroke="#4ade80" strokeWidth={2} dot={false} activeDot={{r:3}}/>
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
