import React, { useState, useEffect } from 'react';
import Overview from './pages/Overview';
import Institutions from './pages/Institutions';
import Funders from './pages/Funders';
import InstBasket from './pages/InstBasket';
import FunderBasket from './pages/FunderBasket';
import Guide from './pages/Guide';
import LoginGate from './pages/LoginGate';
import ErrorPage from './pages/ErrorPage';

function loadBasket(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}

function saveBasket(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export default function App() {
  const [authState, setAuthState] = useState(null);
  const [page, setPage]           = useState('overview');

  const [instBasket,   setInstBasketRaw]   = useState(() => loadBasket('orion_instBasket'));
  const [funderBasket, setFunderBasketRaw] = useState(() => loadBasket('orion_funderBasket'));

  const setInstBasket = val => {
    const next = typeof val === 'function' ? val(instBasket) : val;
    setInstBasketRaw(next);
    saveBasket('orion_instBasket', next);
  };
  const setFunderBasket = val => {
    const next = typeof val === 'function' ? val(funderBasket) : val;
    setFunderBasketRaw(next);
    saveBasket('orion_funderBasket', next);
  };

  const [instData,         setInstData]         = useState({ rows: [], yearFrom: 2020, yearTo: 2025, bytesProcessed: null });
  const [funderData,       setFunderData]       = useState({ rows: [], yearFrom: 2020, yearTo: 2025, bytesProcessed: null });
  const [instBasketData,   setInstBasketData]   = useState({ yearFrom: 2020, yearTo: 2025, worksResult: null, coInstResult: null, coFundResult: null });
  const [funderBasketData, setFunderBasketData] = useState({ yearFrom: 2020, yearTo: 2025, worksResult: null, coInstResult: null, coFundResult: null });

  useEffect(() => {
    fetch('/auth/me')
      .then(r => r.json())
      .then(d => setAuthState(d.authenticated ? d : false))
      .catch(() => setAuthState(false));
  }, []);

  const addInst      = r => setInstBasket(p => p.find(b => b.institution_id === r.institution_id) ? p : [...p, { institution_id: r.institution_id, name: r.name, country: r.country, type: r.type }]);
  const removeInst   = id => { setInstBasket(p => p.filter(b => b.institution_id !== id)); setInstBasketData(d => ({ ...d, worksResult: null, coInstResult: null, coFundResult: null })); };
  const addFunder    = r => setFunderBasket(p => p.find(b => b.funder_id === r.funder_id) ? p : [...p, { funder_id: r.funder_id, name: r.name, country: r.country }]);
  const removeFunder = id => { setFunderBasket(p => p.filter(b => b.funder_id !== id)); setFunderBasketData(d => ({ ...d, worksResult: null, coInstResult: null, coFundResult: null })); };

  const navItem = (key, label, count) => (
    <a key={key} href="#" className={page === key ? 'active' : ''} onClick={e => { e.preventDefault(); setPage(key); }}>
      {label}{count > 0 && <span className="badge">{count}</span>}
    </a>
  );

  if (authState === null) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1117', color: '#475569' }}>
        Loading…
      </div>
    );
  }

  const errorCode = new URLSearchParams(window.location.search).get('error');
  if (errorCode) return <ErrorPage code={errorCode} />;

  if (authState === false) return <LoginGate />;

  return (
    <>
      <nav>
        <span className="logo">⭐ ORION</span>
        <span style={{ fontSize: '.65rem', color: '#2d3148', marginLeft: '-.75rem', marginTop: '.1rem', alignSelf: 'flex-end', paddingBottom: '12px' }}>v0.1.0</span>
        {navItem('overview', 'Overview', 0)}
        {navItem('institutions', 'Institutions', 0)}
        {navItem('funders', 'Funders', 0)}
        {navItem('inst-basket', 'Inst. Basket', instBasket.length)}
        {navItem('funder-basket', 'Funder Basket', funderBasket.length)}
        {navItem('guide', 'Guide', 0)}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '.75rem', color: '#475569' }} title={authState.email}>
            {authState.name || authState.email}
          </span>
          <span style={{ fontSize: '.7rem', color: '#334155' }}>
            billing: <code style={{ color: '#475569' }}>{authState.project_id}</code>
          </span>
          <a href="/auth/logout" style={{ fontSize: '.8rem', color: '#64748b', textDecoration: 'none' }}>Sign out</a>
        </div>
      </nav>
      {page === 'overview'      && <Overview setPage={setPage} />}
      {page === 'institutions'  && <Institutions instData={instData} setInstData={setInstData} basket={instBasket} addToBasket={addInst} />}
      {page === 'funders'       && <Funders funderData={funderData} setFunderData={setFunderData} basket={funderBasket} addToBasket={addFunder} />}
      {page === 'inst-basket'   && <InstBasket basket={instBasket} removeFromBasket={removeInst} basketData={instBasketData} setBasketData={setInstBasketData} addFunderToBasket={addFunder} addInstToBasket={addInst} setPage={setPage} />}
      {page === 'funder-basket' && <FunderBasket basket={funderBasket} removeFromBasket={removeFunder} basketData={funderBasketData} setBasketData={setFunderBasketData} addInstToBasket={addInst} addFunderToBasket={addFunder} setPage={setPage} />}
      {page === 'guide'         && <Guide />}
    </>
  );
}
