import React, { useState, useEffect } from 'react';
import Overview from './pages/Overview';
import Institutions from './pages/Institutions';
import Funders from './pages/Funders';
import InstBasket from './pages/InstBasket';
import FunderBasket from './pages/FunderBasket';
import Guide from './pages/Guide';
import LoginGate from './pages/LoginGate';
import ErrorPage from './pages/ErrorPage';
import useBasket from './pages/useBasket';

export default function App() {
  const [authState, setAuthState] = useState(null);
  const [page, setPage]           = useState('overview');

  const inst   = useBasket('orion_instBasket',  'institution_id', ['institution_id', 'name', 'country', 'type']);
  const funder = useBasket('orion_funderBasket', 'funder_id',      ['funder_id', 'name', 'country']);

  const [instData,         setInstData]         = useState({ rows: [], yearFrom: 2020, yearTo: 2025, bytesProcessed: null });
  const [funderData,       setFunderData]       = useState({ rows: [], yearFrom: 2020, yearTo: 2025, bytesProcessed: null });
  const [instBasketData,   setInstBasketData]   = useState({ yearFrom: 2020, yearTo: 2025, worksResult: null, coInstResult: null, coFundResult: null });
  const [funderBasketData, setFunderBasketData] = useState({ yearFrom: 2020, yearTo: 2025, worksResult: null, coInstResult: null, coFundResult: null });

  const removeInst = id => {
    inst.removeFromBasket(id);
    setInstBasketData(d => ({ ...d, worksResult: null, coInstResult: null, coFundResult: null }));
  };
  const removeFunder = id => {
    funder.removeFromBasket(id);
    setFunderBasketData(d => ({ ...d, worksResult: null, coInstResult: null, coFundResult: null }));
  };
  const clearInst = () => {
    inst.clearBasket();
    setInstBasketData(d => ({ ...d, worksResult: null, coInstResult: null, coFundResult: null }));
  };
  const clearFunder = () => {
    funder.clearBasket();
    setFunderBasketData(d => ({ ...d, worksResult: null, coInstResult: null, coFundResult: null }));
  };

  useEffect(() => {
    fetch('/auth/me')
      .then(r => r.json())
      .then(d => setAuthState(d.authenticated ? d : false))
      .catch(() => setAuthState(false));
  }, []);

  const navTab = (key, label, count) => (
    <a
      key={key}
      href="#"
      className={'nav-tab' + (page === key ? ' active' : '')}
      onClick={e => { e.preventDefault(); setPage(key); }}
    >
      {label}{count > 0 && <span className="badge">{count}</span>}
    </a>
  );

  const searchActive = page === 'institutions' || page === 'funders';
  const basketActive = page === 'inst-basket'  || page === 'funder-basket';

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

        {navTab('overview', 'Overview', 0)}

        <div className={'nav-group' + (searchActive ? ' nav-group-active' : '')}>
          <span className="nav-group-label">Search</span>
          <div className="nav-group-tabs">
            {navTab('institutions', 'Institutions', 0)}
            {navTab('funders',      'Funders',      0)}
          </div>
        </div>

        <div className={'nav-group' + (basketActive ? ' nav-group-active' : '')}>
          <span className="nav-group-label">Basket</span>
          <div className="nav-group-tabs">
            {navTab('inst-basket',   'Institutions', inst.basket.length)}
            {navTab('funder-basket', 'Funders',      funder.basket.length)}
          </div>
        </div>

        {navTab('guide', 'Guide', 0)}

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
      {page === 'institutions'  && <Institutions instData={instData} setInstData={setInstData} basket={inst.basket} addToBasket={inst.addToBasket} projectId={authState.project_id} />}
      {page === 'funders'       && <Funders funderData={funderData} setFunderData={setFunderData} basket={funder.basket} addToBasket={funder.addToBasket} projectId={authState.project_id} />}
      {page === 'inst-basket'   && <InstBasket basket={inst.basket} removeFromBasket={removeInst} clearBasket={clearInst} basketData={instBasketData} setBasketData={setInstBasketData} addInstToBasket={inst.addToBasket} addFunderToBasket={funder.addToBasket} setPage={setPage} projectId={authState.project_id} />}
      {page === 'funder-basket' && <FunderBasket basket={funder.basket} removeFromBasket={removeFunder} clearBasket={clearFunder} basketData={funderBasketData} setBasketData={setFunderBasketData} addInstToBasket={inst.addToBasket} addFunderToBasket={funder.addToBasket} setPage={setPage} projectId={authState.project_id} />}
      {page === 'guide'         && <Guide />}
    </>
  );
}
