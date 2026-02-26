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
      <p style={{color:'#475569',fontSize:'.8rem',marginBottom:'2.5rem'}}>Source: <code>cwts-leiden.openalex_2025aug</code></p>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:'1rem'}}>
        {[
          {
            icon: '🏛',
            title: 'Works → Institutions',
            body: 'The link is work → authorship → institution. An authorship is one author\'s contribution to a work, and the institution is assigned solely from the affiliation that author declared on that paper — not from any other known affiliations of the author.',
          },
          {
            icon: '½',
            title: 'Fractional count',
            body: 'Because a paper can have many authors across many institutions, fractional count avoids double-counting by allocating only a share of each work to each institution. The paper is first split equally among its authors, and each author\'s share is then split equally among their listed affiliations.',
          },
          {
            icon: '💰',
            title: 'Works → Funders',
            body: 'The link is work → grant → funder. OpenAlex constructs this from funding acknowledgements in PDFs, Crossref/DataCite metadata, and direct funder data feeds. Coverage is uneven — especially for older papers — and the data is continuously updated.',
          },
        ].map(({ icon, title, body }) => (
          <div key={title} style={{background:'#1a1d27',border:'1px solid #2d3148',borderRadius:'10px',padding:'1.25rem'}}>
            <div style={{display:'flex',alignItems:'center',gap:'.6rem',marginBottom:'.6rem'}}>
              <span style={{fontSize:'1.1rem'}}>{icon}</span>
              <span style={{fontSize:'.8rem',fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'.05em'}}>{title}</span>
            </div>
            <p style={{fontSize:'.85rem',color:'#94a3b8',lineHeight:1.65,margin:0}}>{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
