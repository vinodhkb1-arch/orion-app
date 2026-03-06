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
      setError('That doesn\'t look like a valid Project ID. It should be 6–30 characters: lowercase letters, digits, and hyphens, starting with a letter.');
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
      <div style={{ width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* ── Header ── */}
        <div style={{ textAlign: 'center', marginBottom: '.5rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '.4rem' }}>⭐</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '.25rem' }}>ORION</h1>
          <p style={{ color: '#64748b', fontSize: '.875rem', margin: 0 }}>Research Dashboard</p>
        </div>

        {/* ── Sign-in card ── */}
        <div style={{ background: '#1a1d27', border: '1px solid #2d3148', borderRadius: '12px', padding: '1.5rem' }}>

          <p style={{ fontSize: '.875rem', color: '#94a3b8', lineHeight: 1.7, marginBottom: '1.25rem', margin: '0 0 1.25rem' }}>
            ORION queries public research data on your behalf using{' '}
            <a href="https://cloud.google.com/bigquery" target="_blank" rel="noreferrer" style={{ color: '#7c8cff' }}>Google BigQuery</a>.
            You need a <strong style={{ color: '#e2e8f0' }}>GCP Project ID</strong> so queries are billed to your account —
            the first <strong style={{ color: '#e2e8f0' }}>1 TB/month</strong> is free and most searches cost far less.
          </p>

          <label style={{ display: 'block', fontSize: '.8rem', color: '#64748b', marginBottom: '.4rem' }}>
            GCP Project ID
          </label>
          <input
            type="text"
            placeholder="my-project-123456"
            value={projectId}
            onChange={e => { setProjectId(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{ width: '100%', background: '#0f1117', border: '1px solid #2d3148', borderRadius: '6px', color: '#e2e8f0', padding: '.6rem .85rem', fontSize: '.9rem', outline: 'none', boxSizing: 'border-box', marginBottom: '.5rem' }}
          />

          <p style={{ color: '#334155', fontSize: '.73rem', lineHeight: 1.6, margin: '0 0 1rem' }}>
            Not sure where to find it?{' '}
            <button
              onClick={() => setShowSetup(s => !s)}
              style={{ background: 'none', border: 'none', color: '#475569', fontSize: '.73rem', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
            >
              {showSetup ? 'Hide help' : 'Show me how →'}
            </button>
          </p>

          {error && (
            <div style={{ color: '#f87171', fontSize: '.8rem', marginBottom: '1rem', padding: '.5rem .75rem', background: '#2d1515', border: '1px solid #7f1d1d', borderRadius: '6px' }}>
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            style={{ width: '100%', background: '#fff', color: '#0f1117', border: 'none', borderRadius: '6px', padding: '.65rem', fontSize: '.95rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.6rem', boxSizing: 'border-box' }}
          >
            <GoogleIcon />
            Sign in with Google
          </button>
        </div>

        {/* ── Setup help (progressive disclosure) ── */}
        {showSetup && (
          <div style={{ background: '#1a1d27', border: '1px solid #2d3148', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            <p style={{ fontSize: '.8rem', color: '#64748b', lineHeight: 1.7, margin: 0 }}>
              Don't have a GCP project yet?{' '}
              <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer" style={{ color: '#7c8cff' }}>
                Create one for free ↗
              </a>
              {' '}— it only takes a minute.
            </p>

            {/* Find project ID */}
            <div>
              <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#64748b', marginBottom: '.5rem' }}>Finding your Project ID</div>
              <ol style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '.78rem', color: '#475569', lineHeight: 2.1 }}>
                <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" style={{ color: '#7c8cff' }}>console.cloud.google.com ↗</a></li>
                <li>Click the <strong style={{ color: '#94a3b8' }}>project dropdown</strong> at the top of the page</li>
                <li>Copy the value in the <strong style={{ color: '#94a3b8' }}>ID</strong> column — it looks like <code style={{ color: '#a78bfa' }}>my-project-123456</code></li>
              </ol>
            </div>

            <div style={{ borderTop: '1px solid #2d3148' }} />

            {/* One-time setup */}
            <div>
              <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#64748b', marginBottom: '.35rem' }}>One-time setup (first use only)</div>
              <p style={{ fontSize: '.78rem', color: '#475569', lineHeight: 1.7, margin: '0 0 .85rem' }}>
                Before your first query, you need to do two quick things in Google Cloud. You only do this once per project.
              </p>

              {/* Step 1 */}
              <div style={{ display: 'flex', gap: '.75rem', marginBottom: '.85rem' }}>
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
