import React, { useState } from 'react';

const SERVICE_ACCOUNT = '112226578999-compute@developer.gserviceaccount.com';

export default function LoginGate() {
  const [projectId, setProjectId]   = useState('');
  const [error, setError]           = useState('');
  const [showSetup, setShowSetup]   = useState(false);

  const handleLogin = () => {
    const pid = projectId.trim();
    if (!pid) { setError('Please enter your GCP Project ID.'); return; }
    if (!/^[a-z][a-z0-9\-]{4,28}[a-z0-9]$/.test(pid)) {
      setError("That doesn't look like a valid Project ID. It should be 6–30 characters: lowercase letters, digits, and hyphens, starting with a letter.");
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

          {/* Requirements notice */}
          <div style={{ background: '#0f1117', border: '1px solid #2d3148', borderRadius: '8px', padding: '.85rem 1rem', marginBottom: '1.25rem' }}>
            <p style={{ fontSize: '.8rem', color: '#94a3b8', lineHeight: 1.75, margin: 0 }}>
              To use ORION you need a <strong style={{ color: '#e2e8f0' }}>Google Cloud (GCP) project</strong> — both to identify yourself and to bill the cost of database queries to your account.
              The first <strong style={{ color: '#e2e8f0' }}>1 TB/month</strong> of queries is free, and typical ORION searches use a small fraction of that.
            </p>
            <p style={{ fontSize: '.8rem', color: '#64748b', lineHeight: 1.75, margin: '.6rem 0 0' }}>
              Before signing in for the first time you also need to <strong style={{ color: '#94a3b8' }}>configure your project</strong> so ORION has permission to run queries on your behalf.
            </p>
          </div>

          <label style={{ display: 'block', fontSize: '.8rem', color: '#94a3b8', marginBottom: '.4rem', fontWeight: 600 }}>
            GCP Project ID
          </label>
          <input
            type="text"
            placeholder="my-project-123456"
            value={projectId}
            onChange={e => { setProjectId(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{ width: '100%', background: '#0f1117', border: '1px solid #2d3148', borderRadius: '6px', color: '#e2e8f0', padding: '.6rem .85rem', fontSize: '.9rem', outline: 'none', boxSizing: 'border-box', marginBottom: '.75rem' }}
          />

          {error && (
            <div style={{ color: '#f87171', fontSize: '.8rem', marginBottom: '.75rem', padding: '.5rem .75rem', background: '#2d1515', border: '1px solid #7f1d1d', borderRadius: '6px' }}>
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            style={{ width: '100%', background: '#fff', color: '#0f1117', border: 'none', borderRadius: '6px', padding: '.65rem', fontSize: '.95rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.6rem', boxSizing: 'border-box', marginBottom: '1rem' }}
          >
            <GoogleIcon />
            Sign in with Google
          </button>

          {/* Prominent setup toggle */}
          <button
            onClick={() => setShowSetup(s => !s)}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: showSetup ? '#2d3148' : '#1e2235',
              border: `1px solid ${showSetup ? '#4a5180' : '#2d3148'}`,
              borderRadius: '8px', padding: '.65rem 1rem',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
              <span style={{ fontSize: '.95rem' }}>⚙️</span>
              <span style={{ fontSize: '.82rem', fontWeight: 700, color: '#94a3b8' }}>
                {showSetup ? 'Hide setup instructions' : 'Need help? — Setup instructions'}
              </span>
            </span>
            <span style={{ color: '#475569', fontSize: '.85rem', transition: 'transform .2s', display: 'inline-block', transform: showSetup ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▾</span>
          </button>
        </div>

        {/* ── Setup help (progressive disclosure) ── */}
        {showSetup && (
          <div style={{ background: '#1a1d27', border: '1px solid #2d3148', borderRadius: '12px', overflow: 'hidden' }}>

            {/* Video link */}
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #2d3148', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
              <span style={{ fontSize: '.9rem' }}>🎬</span>
              <span style={{ fontSize: '.78rem', color: '#64748b' }}>
                Prefer to follow along?{' '}
                <a href="https://drive.google.com/file/d/13ERJc_MG_VO5s4oiEMW5PxJPfSCNz9sS/view?usp=drive_link" target="_blank" rel="noreferrer" style={{ color: '#7c8cff' }}>
                  Watch the setup video ↗
                </a>
              </span>
            </div>

            {/* Part A: Create or find your project */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #2d3148' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.75rem' }}>
                <span style={{ background: '#7c8cff', color: '#0f1117', fontSize: '.7rem', fontWeight: 800, width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>A</span>
                <span style={{ fontSize: '.8rem', fontWeight: 700, color: '#94a3b8' }}>Get a GCP project</span>
              </div>

              <p style={{ fontSize: '.78rem', color: '#475569', lineHeight: 1.7, margin: '0 0 .75rem' }}>
                If you don't have a GCP project yet,{' '}
                <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer" style={{ color: '#7c8cff' }}>create one for free ↗</a>
                {' '}— it takes about a minute.
              </p>

              <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#64748b', marginBottom: '.4rem' }}>Finding your Project ID</div>
              <ol style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '.78rem', color: '#475569', lineHeight: 2.1 }}>
                <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" style={{ color: '#7c8cff' }}>console.cloud.google.com ↗</a></li>
                <li>Click the <strong style={{ color: '#94a3b8' }}>project dropdown</strong> at the top of the page</li>
                <li>Copy the value in the <strong style={{ color: '#94a3b8' }}>ID</strong> column — it looks like <code style={{ color: '#a78bfa' }}>my-project-123456</code></li>
              </ol>
            </div>

            {/* Part B: Configure the project */}
            <div style={{ padding: '1.25rem 1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.75rem' }}>
                <span style={{ background: '#7c8cff', color: '#0f1117', fontSize: '.7rem', fontWeight: 800, width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>B</span>
                <span style={{ fontSize: '.8rem', fontWeight: 700, color: '#94a3b8' }}>Configure your project to work with ORION <span style={{ fontWeight: 400, color: '#475569' }}>(one-time)</span></span>
              </div>

              <p style={{ fontSize: '.78rem', color: '#475569', lineHeight: 1.7, margin: '0 0 1rem' }}>
                Do these two steps once per project before your first query. They allow ORION to run BigQuery jobs billed to your project.
              </p>

              {/* Step 1 */}
              <div style={{ display: 'flex', gap: '.75rem', marginBottom: '1rem' }}>
                <div style={{ flexShrink: 0, width: '22px', height: '22px', borderRadius: '50%', background: '#2d3148', color: '#7c8cff', fontSize: '.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</div>
                <div style={{ fontSize: '.78rem', color: '#475569', lineHeight: 1.7 }}>
                  <strong style={{ color: '#94a3b8' }}>Enable BigQuery</strong> on your project:{' '}
                  <a href={bqApiUrl} target="_blank" rel="noreferrer" style={{ color: '#7c8cff' }}>
                    Enable BigQuery API{projectId.trim() ? ` on ${projectId.trim()}` : ''} ↗
                  </a>
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ display: 'flex', gap: '.75rem' }}>
                <div style={{ flexShrink: 0, width: '22px', height: '22px', borderRadius: '50%', background: '#2d3148', color: '#7c8cff', fontSize: '.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</div>
                <div style={{ fontSize: '.78rem', color: '#475569', lineHeight: 1.7 }}>
                  <strong style={{ color: '#94a3b8' }}>Give ORION permission to run queries.</strong>{' '}
                  Open{' '}
                  <a href={iamUrl} target="_blank" rel="noreferrer" style={{ color: '#7c8cff' }}>
                    IAM &amp; Admin{projectId.trim() ? ` for ${projectId.trim()}` : ''} ↗
                  </a>
                  {', '}click <strong style={{ color: '#94a3b8' }}>Grant Access</strong>, and add:
                  <div style={{ background: '#0f1117', border: '1px solid #2d3148', borderRadius: '7px', padding: '.7rem .9rem', margin: '.6rem 0', display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
                    <div>
                      <span style={{ fontSize: '.7rem', color: '#334155', display: 'block', marginBottom: '.15rem' }}>New principal</span>
                      <code style={{ color: '#a78bfa', fontSize: '.77rem', userSelect: 'all', wordBreak: 'break-all' }}>{SERVICE_ACCOUNT}</code>
                    </div>
                    <div>
                      <span style={{ fontSize: '.7rem', color: '#334155', display: 'block', marginBottom: '.15rem' }}>Role</span>
                      <code style={{ color: '#4ade80', fontSize: '.77rem' }}>BigQuery Job User</code>
                    </div>
                  </div>
                  This only allows ORION to submit queries — it <strong style={{ color: '#94a3b8' }}>cannot</strong> read or modify anything in your project.
                </div>
              </div>
            </div>
          </div>
        )}

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
