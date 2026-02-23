import React, { useState } from 'react';
import Overview from './pages/Overview';
import Institutions from './pages/Institutions';
import Funders from './pages/Funders';
import InstBasket from './pages/InstBasket';
import FunderBasket from './pages/FunderBasket';

export default function App() {
  const [page, setPage] = useState('overview');
  const [instBasket,   setInstBasket]   = useState([]);
  const [funderBasket, setFunderBasket] = useState([]);
  // Persisted table data — survives tab switches
  const [instData,   setInstData]   = useState({ rows: [], yearFrom: 2020, yearTo: 2025 });
  const [funderData, setFunderData] = useState({ rows: [], yearFrom: 2020, yearTo: 2025 });

  const addInst    = r => setInstBasket(p => p.find(b=>b.institution_id===r.institution_id) ? p : [...p,{institution_id:r.institution_id,name:r.name,country:r.country,type:r.type}]);
  const removeInst = id => setInstBasket(p => p.filter(b=>b.institution_id!==id));
  const addFunder    = r => setFunderBasket(p => p.find(b=>b.funder_id===r.funder_id) ? p : [...p,{funder_id:r.funder_id,name:r.name,country:r.country}]);
  const removeFunder = id => setFunderBasket(p => p.filter(b=>b.funder_id!==id));

  const navItem = (key, label, count) => (
    <a key={key} href="#" className={page===key?'active':''} onClick={e=>{e.preventDefault();setPage(key);}}>
      {label}{count>0&&<span className="badge">{count}</span>}
    </a>
  );

  return (
    <>
      <nav>
        <span className="logo">⭐ ORION</span>
        {navItem('overview','Overview',0)}
        {navItem('institutions','Institutions',0)}
        {navItem('funders','Funders',0)}
        {navItem('inst-basket','Inst. Basket',instBasket.length)}
        {navItem('funder-basket','Funder Basket',funderBasket.length)}
      </nav>
      {page==='overview'      && <Overview setPage={setPage}/>}
      {page==='institutions'  && <Institutions instData={instData} setInstData={setInstData} basket={instBasket} addToBasket={addInst}/>}
      {page==='funders'       && <Funders funderData={funderData} setFunderData={setFunderData} basket={funderBasket} addToBasket={addFunder}/>}
      {page==='inst-basket'   && <InstBasket basket={instBasket} removeFromBasket={removeInst}/>}
      {page==='funder-basket' && <FunderBasket basket={funderBasket} removeFromBasket={removeFunder}/>}
    </>
  );
}
