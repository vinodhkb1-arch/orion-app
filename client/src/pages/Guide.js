import React, { useState } from 'react';

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '2.5rem' }}>
      <div style={{ fontSize: '.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.75rem' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Step({ n, children }) {
  return (
    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'flex-start' }}>
      <div style={{ flexShrink: 0, width: '24px', height: '24px', borderRadius: '50%', background: '#2d3148', color: '#7c8cff', fontSize: '.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {n}
      </div>
      <div style={{ fontSize: '.875rem', color: '#94a3b8', lineHeight: 1.7, paddingTop: '2px' }}>
        {children}
      </div>
    </div>
  );
}

function CodeBlock({ children }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(children.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ position: 'relative', marginTop: '.75rem', marginBottom: '.75rem' }}>
      <pre style={{ background: '#0f1117', border: '1px solid #2d3148', borderRadius: '8px', padding: '1rem 1.25rem', fontSize: '.8rem', color: '#a78bfa', overflowX: 'auto', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {children.trim()}
      </pre>
      <button
        onClick={copy}
        style={{ position: 'absolute', top: '.5rem', right: '.5rem', background: copied ? '#14532d' : '#2d3148', color: copied ? '#4ade80' : '#64748b', border: 'none', borderRadius: '4px', padding: '.25rem .6rem', fontSize: '.7rem', cursor: 'pointer', transition: 'all .2s' }}
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  );
}

function Note({ children }) {
  return (
    <div style={{ background: '#1a1d27', border: '1px solid #2d3148', borderLeft: '3px solid #7c8cff', borderRadius: '0 6px 6px 0', padding: '.75rem 1rem', fontSize: '.825rem', color: '#64748b', lineHeight: 1.65, marginTop: '.75rem', marginBottom: '.75rem' }}>
      {children}
    </div>
  );
}

const EXAMPLE_QUERY = `-- Step 1: paste your export query here as a CTE
WITH my_works AS (
  -- (paste the query from the basket here)
)

-- Step 2: join with the work table to get titles and DOIs
SELECT
  w.work_id,
  w.title,
  w.doi,
  w.pub_year
FROM my_works mw
JOIN \`cwts-leiden.openalex_2025aug.work\` w
  ON mw.work_id = w.work_id
ORDER BY w.pub_year DESC`;

export default function Guide() {
  return (
    <div className="page" style={{ maxWidth: '860px' }}>
      <h1>Guide</h1>
      <p style={{ color: '#64748b', marginBottom: '2.5rem', fontSize: '.925rem', lineHeight: 1.7 }}>
        ORION lets you explore institutions and funders interactively. When you want to go deeper —
        downloading the full list of papers behind a result — you can generate a BigQuery query and
        run it yourself. This guide walks you through the whole process from scratch.
      </p>

      <Section title="1 — What is a work ID?">
        <p style={{ fontSize: '.875rem', color: '#94a3b8', lineHeight: 1.7 }}>
          Every paper in the OpenAlex dataset has a unique <code style={{ color: '#a78bfa' }}>work_id</code> — a numeric identifier
          that links it across all tables. When you export from ORION, you get a list of these IDs.
          That list is small and fast to download, and from it you can join any other table in the
          dataset to get titles, abstracts, DOIs, citation counts, author lists, and more.
        </p>
        <Note>
          The full OpenAlex dataset is publicly available at <code>cwts-leiden.openalex_2025aug</code> in BigQuery.
          You already have access to it — it's the same dataset ORION queries on your behalf.
        </Note>
      </Section>

      <Section title="2 — Generating your export query">
        <Step n="1">
          Go to either the <strong style={{ color: '#e2e8f0' }}>Institution Basket</strong> or <strong style={{ color: '#e2e8f0' }}>Funder Basket</strong> tab
          and add the institutions or funders you are interested in.
        </Step>
        <Step n="2">
          Set your year range, then click <strong style={{ color: '#e2e8f0' }}>Get export query</strong>.
          A panel will open showing a SQL query tailored to your exact basket and filters.
        </Step>
        <Step n="3">
          Click <strong style={{ color: '#e2e8f0' }}>Copy</strong> to copy the query to your clipboard.
        </Step>
      </Section>

      <Section title="3 — Running the query in BigQuery">
        <Step n="1">
          Go to <a href="https://console.cloud.google.com/bigquery" target="_blank" rel="noreferrer" style={{ color: '#7c8cff' }}>console.cloud.google.com/bigquery</a> and
          make sure your project is selected in the top bar (the same project ID you used to log in to ORION).
        </Step>
        <Step n="2">
          Click <strong style={{ color: '#e2e8f0' }}>+ Compose a new query</strong> (the button with a "+" in the top left of the editor area).
        </Step>
        <Step n="3">
          Paste your query into the editor and click <strong style={{ color: '#e2e8f0' }}>Run</strong>.
          The results will appear in a table below. BigQuery will show you how much data was scanned
          before you run — this is what gets billed to your project.
        </Step>
        <Step n="4">
          To save the results, click <strong style={{ color: '#e2e8f0' }}>Save results</strong> above the results table.
          You can download as CSV, or save it as a new BigQuery table in your own project for further analysis.
        </Step>
        <Note>
          The first 1 TB of data scanned per month is free on Google Cloud. A typical ORION export
          query scans well under that, so most users will pay nothing.
        </Note>
      </Section>

      <Section title="4 — Joining with other OpenAlex tables">
        <p style={{ fontSize: '.875rem', color: '#94a3b8', lineHeight: 1.7, marginBottom: '.75rem' }}>
          Once you have a list of <code style={{ color: '#a78bfa' }}>work_id</code>s, you can join it with any table
          in <code style={{ color: '#a78bfa' }}>cwts-leiden.openalex_2025aug</code> using that field as the key.
          Here is an example that retrieves the title, DOI, and year for each work:
        </p>
        <CodeBlock>{EXAMPLE_QUERY}</CodeBlock>
        <p style={{ fontSize: '.875rem', color: '#94a3b8', lineHeight: 1.7, marginTop: '.75rem' }}>
          Some other useful tables you can join on <code style={{ color: '#a78bfa' }}>work_id</code>:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem', marginTop: '.5rem' }}>
          {[
            { table: 'work_authorship', desc: 'Author names and positions' },
            { table: 'work_affiliation_institution', desc: 'Author–institution links' },
            { table: 'work_grant', desc: 'Funding grants acknowledged' },
            { table: 'work_topic', desc: 'Research topics / fields' },
            { table: 'work_concept', desc: 'OpenAlex concept tags' },
            { table: 'work_reference', desc: 'Citation references' },
          ].map(({ table, desc }) => (
            <div key={table} style={{ background: '#0f1117', border: '1px solid #2d3148', borderRadius: '6px', padding: '.6rem .85rem' }}>
              <code style={{ fontSize: '.775rem', color: '#a78bfa' }}>{table}</code>
              <div style={{ fontSize: '.775rem', color: '#475569', marginTop: '.2rem' }}>{desc}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="5 — Need help?">
        <p style={{ fontSize: '.875rem', color: '#94a3b8', lineHeight: 1.7 }}>
          If you are new to BigQuery, Google's{' '}
          <a href="https://cloud.google.com/bigquery/docs/query-overview" target="_blank" rel="noreferrer" style={{ color: '#7c8cff' }}>
            query overview documentation
          </a>{' '}
          is a good starting point. The OpenAlex data model is documented at{' '}
          <a href="https://docs.openalex.org" target="_blank" rel="noreferrer" style={{ color: '#7c8cff' }}>
            docs.openalex.org
          </a>.
        </p>
      </Section>
    </div>
  );
}
