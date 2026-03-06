import React from 'react';

const NAV_CARDS = [
  { key: 'institutions',   icon: '🏛',  label: 'Institutions',  group: 'Search'  },
  { key: 'funders',        icon: '💰',  label: 'Funders',       group: 'Search'  },
  { key: 'inst-basket',    icon: '🛒',  label: 'Institutions',  group: 'Basket'  },
  { key: 'funder-basket',  icon: '🛒',  label: 'Funders',       group: 'Basket'  },
  { key: 'guide',          icon: '📖',  label: 'Guide',         group: null      },
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
        {NAV_CARDS.map(({ key, icon, label, group }) => (
          <button
            key={key}
            className="card"
            onClick={() => setPage(key)}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setPage(key)}
          >
            <div className="val">{icon}</div>
            <div className="lbl">{group ? <><span style={{fontSize:'.65em',color:'#475569',display:'block',marginBottom:'.1em'}}>{group}</span>{label}</> : label}</div>
          </button>
        ))}
      </div>
      <p style={{color:'#475569',fontSize:'.8rem',marginBottom:'2.5rem'}}>
        Source: <code>cwts-leiden.openalex_2025aug</code>
        <span style={{marginLeft:'1.25rem',color:'#334155'}}>v0.1.0</span>
      </p>

      <div style={{marginTop:'1.5rem',padding:'1rem',background:'#1a1d27',border:'1px solid #2d3148',borderRadius:'8px',maxWidth:'500px'}}>
        <p style={{color:'#475569',fontSize:'.825rem',lineHeight:1.7,margin:0}}>
          New to ORION? The <strong style={{color:'#64748b'}}>Guide</strong> tab explains how the data is structured,
          how co-occurrence networks are built, and how to export results to BigQuery.
        </p>
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
