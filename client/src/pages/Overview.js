import React from 'react';
export default function Overview({ setPage }) {
  return (
    <div className="page">
      <h1>ORION Research Dashboard</h1>
      <p style={{color:'#64748b',marginBottom:'2rem'}}>Explore research institutions and funders from the CWTS/OpenAlex 2025 dataset.</p>
      <div className="cards">
        <div className="card" onClick={()=>setPage('institutions')}><div className="val">🏛</div><div className="lbl">Institutions</div></div>
        <div className="card" onClick={()=>setPage('funders')}><div className="val">💰</div><div className="lbl">Funders</div></div>
        <div className="card" onClick={()=>setPage('inst-basket')}><div className="val">🛒</div><div className="lbl">Institution Basket</div></div>
        <div className="card" onClick={()=>setPage('funder-basket')}><div className="val">🛒</div><div className="lbl">Funder Basket</div></div>
      </div>
      <p style={{color:'#475569',fontSize:'.8rem'}}>Source: <code>cwts-leiden.openalex_2025aug</code></p>
    </div>
  );
}
