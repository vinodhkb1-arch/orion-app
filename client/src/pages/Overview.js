import React from 'react';

const NAV_CARDS = [
  { key: 'institutions',   icon: '🏛',  label: 'Institutions'       },
  { key: 'funders',        icon: '💰',  label: 'Funders'            },
  { key: 'inst-basket',    icon: '🛒',  label: 'Institution Basket' },
  { key: 'funder-basket',  icon: '🛒',  label: 'Funder Basket'      },
  { key: 'guide',          icon: '📖',  label: 'Guide'              },
];

export default function Overview({ setPage }) {
  return (
    <div className="page">
      <h1>ORION Research Dashboard</h1>
      <p style={{color:'#64748b',marginBottom:'1rem'}}>Explore research institutions and funders from the CWTS/OpenAlex 2025 dataset.</p>
      <p style={{color:'#334155',fontSize:'.8rem',marginBottom:'2rem'}}>
        Open source · MIT License ·{' '}
        <a href="https://github.com/jpbascur/orion-app" target="_blank" rel="noreferrer" style={{color:'#475569'}}>
          github.com/jpbascur/orion-app
        </a>
      </p>
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
      <p style={{color:'#475569',fontSize:'.8rem',marginBottom:'2.5rem'}}>
        Source: <code>cwts-leiden.openalex_2025aug</code>
        <span style={{marginLeft:'1.25rem',color:'#334155'}}>v0.1.0</span>
      </p>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:'1rem'}}>
        {[
          {
            icon: '🏛',
            title: 'Works → Institutions',
            body: 'The link is work → authorship → institution. An authorship is one author\'s contribution to a work, and the institution is assigned solely from the affiliation that author declared on that paper — not from any other known affiliations of the author.',
          },
          /* FRACTIONAL COUNT — hidden for now, re-enable by uncommenting
          {
            icon: '½',
            title: 'Fractional count',
            body: 'Because a paper can have many authors across many institutions, fractional count avoids double-counting by allocating only a share of each work to each institution. The paper is first split equally among its authors, and each author\'s share is then split equally among their listed affiliations.',
          },
          */
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

      {/* Acknowledgements */}
      <div style={{marginTop:'2.5rem',paddingTop:'2rem',borderTop:'1px solid #1e2235'}}>
        <p style={{fontSize:'.7rem',color:'#334155',marginBottom:'.6rem',textTransform:'uppercase',letterSpacing:'.06em',fontWeight:600}}>Acknowledgements</p>
        <p style={{fontSize:'.78rem',color:'#475569',lineHeight:1.8,maxWidth:'720px'}}>
          Data provided by the{' '}
          <a href="https://orion-dbs.community" target="_blank" rel="noreferrer" style={{color:'#64748b'}}>ORION — Open Research Information on BigQuery</a>
          {' '}initiative and{' '}
          <a href="https://www.cwts.nl/" target="_blank" rel="noreferrer" style={{color:'#64748b'}}>CWTS Leiden</a>.
          {' '}Research data sourced from{' '}
          <a href="https://openalex.org" target="_blank" rel="noreferrer" style={{color:'#64748b'}}>OpenAlex</a>
          {' '}(CC0).
          {' '}Network visualisation powered by{' '}
          <a href="https://app.vosviewer.com" target="_blank" rel="noreferrer" style={{color:'#64748b'}}>VOSviewer Online</a>
          {' '}(Van Eck &amp; Waltman, CWTS Leiden).
        </p>
        <p style={{fontSize:'.72rem',color:'#2d3148',marginTop:'.75rem'}}>
          MIT License · © 2025 Juan Pablo Bascur Cifuentes ·{' '}
          <a href="https://github.com/jpbascur/orion-app" target="_blank" rel="noreferrer" style={{color:'#334155'}}>github.com/jpbascur/orion-app</a>
        </p>
      </div>
    </div>
  );
}
