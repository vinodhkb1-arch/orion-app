import React, { useState } from 'react';
import useTable from './useTable';
import { apiFetch, exportCsv } from '../api';
import { BytesTag } from '../bytesInfo';

const FIELDS = [{value:'name',label:'Name'},{value:'country',label:'Country (ISO)'},{value:'description',label:'Description'}];

export default function Funders({ funderData, setFunderData, basket, addToBasket }) {
  const { rows, yearFrom: fetchedYF, yearTo: fetchedYT, bytesProcessed } = funderData;
  const [loading, setLoading] = useState(false);
  const [q, setQ]             = useState('');
  const [field, setField]     = useState('name');
  const [yearFrom, setYF]     = useState(fetchedYF);
  const [yearTo, setYT]       = useState(fetchedYT);
  const { visibleRows, onSort, sortIcon, sortKey } = useTable(rows, 1000);

  const fetchData = (yf, yt, sq, sf) => {
    setLoading(true);
    const url = sq.trim()
      ? `/api/funders/search?q=${encodeURIComponent(sq)}&field=${sf}&year_from=${yf}&year_to=${yt}&limit=1000`
      : `/api/funders/top?year_from=${yf}&year_to=${yt}&limit=1000`;
    apiFetch(url)
      .then(d => {
        if (d) setFunderData({ rows: d.rows, yearFrom: yf, yearTo: yt, bytesProcessed: d.bytes_processed });
        setLoading(false);
      })
      .catch(() => { setFunderData({ rows: [], yearFrom: yf, yearTo: yt, bytesProcessed: null }); setLoading(false); });
  };

  const apply = () => fetchData(yearFrom, yearTo, q, field);

  const inBasket = id => basket.some(b => b.funder_id === id);

  const SortTh = ({k, children}) => (
    <th onClick={() => onSort(k)} className={sortKey === k ? 'sorted' : ''}>{children}{sortIcon(k)}</th>
  );

  return (
    <div className="page">
      <h1>Funders</h1>
      <div className="controls">
        <div className="field-group">
          <label>Search by</label>
          <select value={field} onChange={e => setField(e.target.value)}>
            {FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <input type="text" placeholder={`Search by ${FIELDS.find(f => f.value === field)?.label}…`}
          value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && apply()}/>
        <div className="divider"/>
        <div className="field-group">
          <label>Years</label>
          <input type="number" value={yearFrom} onChange={e => setYF(Number(e.target.value))}/>
          <label>–</label>
          <input type="number" value={yearTo} onChange={e => setYT(Number(e.target.value))}/>
        </div>
        <button className="btn" onClick={apply}>Search</button>
        {rows.length > 0 && <button className="btn ghost" onClick={() => exportCsv(rows, 'funders.csv')}>⬇ CSV</button>}
        {rows.length > 0 && <BytesTag bytes={bytesProcessed} />}
      </div>

      {loading && <div className="status">Loading…</div>}
      {!loading && rows.length === 0 && <div className="status">Use the controls above and click Search to load data.</div>}
      {!loading && rows.length > 0 && (
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
              {visibleRows.map((r, i) => (
                <tr key={r.funder_id}
                  className={inBasket(r.funder_id) ? 'in-basket' : ''}>
                  <td className="rank">{i+1}</td>
                  <td>{r.thumbnail_url ? <img className="thumb" src={r.thumbnail_url} alt=""/> : <div className="thumb"/>}</td>
                  <td>{r.name}</td>
                  <td>{r.country ? <span className="badge-country">{r.country}</span> : '—'}</td>
                  <td className="desc">{r.description || '—'}</td>
                  <td className="works">{Number(r.works_count).toLocaleString()}</td>
                  <td onClick={e => e.stopPropagation()}>
                    {inBasket(r.funder_id)
                      ? <span style={{color:'#4ade80',fontSize:'.8rem'}}>✓</span>
                      : <button className="btn secondary" style={{padding:'.2rem .5rem',fontSize:'.75rem'}} onClick={() => addToBasket(r)}>+</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="tbl-footer">
            <span>Showing {visibleRows.length} of {rows.length} results</span>
            {sortKey && <span className="sort-note">Sorted within first {visibleRows.length} results</span>}
          </div>
        </div>
      )}
    </div>
  );
}
