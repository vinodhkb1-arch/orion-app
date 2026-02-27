import React, { useState } from 'react';

const SERVICE_ACCOUNT = '112226578999-compute@developer.gserviceaccount.com';

export default function LoginGate() {
  const [projectId, setProjectId] = useState('');
  const [error, setError]         = useState('');

  const handleLogin = () => {
    const pid = projectId.trim();
    if (!pid) { setError('Please enter your GCP Project ID.'); return; }
    if (!/^[a-z][a-z0-9\-]{4,28}[a-z0-9]$/.test(pid)) {
      setError('Invalid project ID. Must be 6–30 characters: lowercase letters, digits, and hyphens only, starting with a letter.');
      return;
    }
    window.location.href = `/auth/login?project_id=${encodeURIComponent(pid)}`;
  };

  const iamUrl = projectId.trim()
    ? `https://console.cloud.google.com/iam-admin/iam?project=${projectId.trim()}`
    : 'https://console.cloud.google.com/iam-admin/iam';

  const bqApiUrl = projectId.trim()
    ? `https://console.cloud.google.com/apis/library/bigquery.googleapis.com?project=${projectId.trim()}`
    : 'https://console.cloud.google.com/apis/library/bigquery.googleapis.com';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1117', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* ── Header ── */}
        <div style={{ textAlign: 'center', marginBottom: '.5rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '.4rem' }}>⭐</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '.25rem' }}>ORION</h1>
          <p style={{ color: '#64748b', fontSize: '.875rem', margin: 0 }}>Research Dashboard</p>
        </div>

        {/* ── Sign-in card ── */}
        <div style={{ background: '#1a1d27', border: '1px solid #2d3148', borderRadius: '12px', padding: '1.5rem' }}>

          <label style={{ display: 'block', fontSize: '.8rem', color: '#64748b', marginBottom: '.4rem' }}>
            Your existing GCP Project ID
          </label>
          <input
            type="text"
            placeholder="my-gcp-project-123"
            value={projectId}
            onChange={e => { setProjectId(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{ width: '100%', background: '#0f1117', border: '1px solid #2d3148', borderRadius: '6px', color: '#e2e8f0', padding: '.6rem .85rem', fontSize: '.9rem', outline: 'none', boxSizing: 'border-box', marginBottom: '.5rem' }}
          />
          <p style={{ color: '#475569', fontSize: '.75rem', lineHeight: 1.6, marginBottom: '1rem' }}>
            This must be a GCP project that <strong style={{ color: '#64748b' }}>already exists</strong> — you are not creating a project here.
            BigQuery costs for your queries will be billed to this project.
          </p>

          {error && <div style={{ color: '#f87171', fontSize: '.8rem', marginBottom: '1rem', padding: '.5rem .75rem', background: '#2d1515', border: '1px solid #7f1d1d', borderRadius: '6px' }}>{error}</div>}

          <button
            onClick={handleLogin}
            style={{ width: '100%', background: '#fff', color: '#0f1117', border: 'none', borderRadius: '6px', padding: '.65rem', fontSize: '.95rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.6rem', boxSizing: 'border-box' }}
          >
            <GoogleIcon />
            Sign in with Google
          </button>
        </div>

        {/* ── First-time setup block (always open) ── */}
        <div style={{ background: '#1a1d27', border: '1px solid #2d3148', borderRadius: '12px', padding: '1.5rem' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1rem' }}>⚙️</span>
            <span style={{ fontSize: '.85rem', fontWeight: 700, color: '#94a3b8' }}>Important: first-time setup</span>
          </div>

          <p style={{ fontSize: '.8rem', color: '#64748b', lineHeight: 1.7, marginBottom: '1.25rem' }}>
            ORION needs a GCP project to bill your BigQuery queries to.
            If you don't have one, <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer" style={{ color: '#7c8cff' }}>create a free GCP project ↗</a>.
            The first <strong style={{ color: '#94a3b8' }}>1 TB/month</strong> of queries is free — most users pay nothing.
          </p>

          {/* Step 0: find project ID */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#64748b', marginBottom: '.5rem' }}>
              How to find your Project ID
            </div>
            <ol style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '.78rem', color: '#475569', lineHeight: 2 }}>
              <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" style={{ color: '#7c8cff' }}>console.cloud.google.com ↗</a></li>
              <li>Click the project dropdown at the very top of the page</li>
              <li>Copy the <strong style={{ color: '#94a3b8' }}>ID</strong> column (not the name) — it looks like <code style={{ color: '#a78bfa' }}>my-project-123456</code></li>
            </ol>
          </div>

          <div style={{ borderTop: '1px solid #2d3148', margin: '0 0 1.25rem' }} />

          {/* Step 1: Enable BigQuery API */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#64748b', marginBottom: '.5rem' }}>
              Step 1 — Enable the BigQuery API on your project
            </div>
            <p style={{ fontSize: '.78rem', color: '#475569', lineHeight: 1.7, margin: '0 0 .4rem' }}>
              BigQuery must be activated on your project before ORION can use it.
            </p>
            <a
              href={bqApiUrl}
              target="_blank" rel="noreferrer"
              style={{ display: 'inline-block', fontSize: '.78rem', color: '#7c8cff' }}
            >
              Enable BigQuery API{projectId.trim() ? ` on ${projectId.trim()}` : ''} ↗
            </a>
          </div>

          {/* Step 2: Grant IAM role */}
          <div>
            <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#64748b', marginBottom: '.5rem' }}>
              Step 2 — Grant ORION permission to run queries on your project
            </div>
            <p style={{ fontSize: '.78rem', color: '#475569', lineHeight: 1.7, margin: '0 0 .75rem' }}>
              ORION runs queries using a shared service account. You need to give it the
              {' '}<strong style={{ color: '#94a3b8' }}>BigQuery Job User</strong> role on your project — this only allows
              submitting query jobs, it does <strong style={{ color: '#94a3b8' }}>not</strong> give access to any of your data.
            </p>

            <div style={{ background: '#0f1117', border: '1px solid #2d3148', borderRadius: '8px', padding: '.85rem 1rem', marginBottom: '.75rem' }}>
              <div style={{ marginBottom: '.5rem' }}>
                <span style={{ fontSize: '.72rem', color: '#334155', display: 'block', marginBottom: '.2rem' }}>New principal (copy this exactly):</span>
                <code style={{ color: '#a78bfa', fontSize: '.78rem', userSelect: 'all', wordBreak: 'break-all' }}>{SERVICE_ACCOUNT}</code>
              </div>
              <div>
                <span style={{ fontSize: '.72rem', color: '#334155', display: 'block', marginBottom: '.2rem' }}>Role:</span>
                <code style={{ color: '#4ade80', fontSize: '.78rem' }}>BigQuery Job User</code>
              </div>
            </div>

            <ol style={{ margin: '0 0 .5rem', paddingLeft: '1.25rem', fontSize: '.78rem', color: '#475569', lineHeight: 2 }}>
              <li>Open <a href={iamUrl} target="_blank" rel="noreferrer" style={{ color: '#7c8cff' }}>IAM & Admin → IAM{projectId.trim() ? ` for ${projectId.trim()}` : ''} ↗</a></li>
              <li>Click <strong style={{ color: '#94a3b8' }}>Grant Access</strong></li>
              <li>Paste the service account address above as the new principal</li>
              <li>Select the role <strong style={{ color: '#94a3b8' }}>BigQuery Job User</strong></li>
              <li>Click <strong style={{ color: '#94a3b8' }}>Save</strong></li>
            </ol>
          </div>
        </div>

        {/* ── Footer ── */}
        <p style={{ color: '#2d3148', fontSize: '.7rem', textAlign: 'center', lineHeight: 1.7 }}>
          Your Google account is used for identity only.{' '}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" style={{ color: '#334155' }}>Revoke access</a>
          {' · '}
          <a href="https://github.com/jpbascur/orion-app" target="_blank" rel="noreferrer" style={{ color: '#334155' }}>github.com/jpbascur/orion-app</a>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}
