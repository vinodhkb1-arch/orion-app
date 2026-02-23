import React from 'react';

const NAV_CARDS = [
  { key: 'institutions',   icon: '🏛',  label: 'Institutions'       },
  { key: 'funders',        icon: '💰',  label: 'Funders'            },
  { key: 'inst-basket',    icon: '🛒',  label: 'Institution Basket' },
  { key: 'funder-basket',  icon: '🛒',  label: 'Funder Basket'      },
];

export default function Overview({ setPage }) {
  return (
    <div className="page">
      <h1>ORION Research Dashboard</h1>
      <p style={{color:'#64748b',marginBottom:'2rem'}}>Explore research institutions and funders from the CWTS/OpenAlex 2025 dataset.</p>
      <div className="cards">
        {NAV_CARDS.map(({ key, icon, label }) => (
          <button
            key={key}
            className="card"
            onClick={() => setPage(key)}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setPage(key)}
          >
            <div className="val">{icon}</div>
            <div className="lbl">{label}</div>
          </button>
        ))}
      </div>
      <p style={{color:'#475569',fontSize:'.8rem'}}>Source: <code>cwts-leiden.openalex_2025aug</code></p>
    </div>
  );
}
