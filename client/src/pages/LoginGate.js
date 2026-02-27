import React, { useState } from 'react';

const SERVICE_ACCOUNT = '112226578999-compute@developer.gserviceaccount.com';

export default function LoginGate() {
  const [projectId, setProjectId] = useState('');
  const [error, setError]         = useState('');
  const [showSetup, setShowSetup] = useState(false);

  const handleLogin = () => {
    const pid = projectId.trim();
    if (!pid) { setError('Please enter your GCP Project ID.'); return; }
    // GCP project IDs: 6–30 chars, lowercase letters/digits/hyphens, must start with a letter, no trailing hyphen
    if (!/^[a-z][a-z0-9\-]{4,28}[a-z0-9]$/.test(pid)) {
      setError('Invalid project ID. Must be 6–30 characters: lowercase letters, digits, and hyphens only, starting with a letter.');
      return;
    }
    window.location.href = `/auth/login?project_id=${encodeURIComponent(pid)}`;
  };

  const iamUrl = projectId.trim()
    ? `https://console.cloud.google.com/iam-admin/iam?project=${projectId.trim()}`
    : 'https://console.cloud.google.com/iam-admin/iam';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1117', padding: '1rem' }}>
      <div style={{ background: '#1a1d27', border: '1px solid #2d3148', borderRadius: '14px', padding: '2.5rem', width: '100%', maxWidth: '460px' }}>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '.5rem' }}>⭐</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '.4rem' }}>ORION</h1>
          <p style={{ color: '#64748b', fontSize: '.875rem' }}>Research Dashboard</p>
        </div>

        {/* Project ID input */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', fontSize: '.8rem', color: '#64748b', marginBottom: '.4rem' }}>
            Your GCP Project ID
          </label>
          <input
            type="text"
            placeholder="my-gcp-project-123"
            value={projectId}
            onChange={e => { setProjectId(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{ width: '100%', background: '#0f1117', border: '1px solid #2d3148', borderRadius: '6px', color: '#e2e8f0', padding: '.6rem .85rem', fontSize: '.9rem', outline: 'none', boxSizing: 'border-box' }}
          />
          <p style={{ color: '#475569', fontSize: '.75rem', marginTop: '.5rem', lineHeight: 1.6 }}>
            BigQuery query costs are billed to this project.
            Need a project?{' '}
            <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer" style={{ color: '#7c8cff' }}>
              Create one free ↗
            </a>
            {' '}(1 TB/month free, most users pay nothing).
          </p>
        </div>

        {error && <div style={{ color: '#f87171', fontSize: '.8rem', marginBottom: '1rem' }}>{error}</div>}

        <button
          onClick={handleLogin}
          style={{ width: '100%', background: '#fff', color: '#0f1117', border: 'none', borderRadius: '6px', padding: '.65rem', fontSize: '.95rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.6rem', boxSizing: 'border-box' }}
        >
          <GoogleIcon />
          Sign in with Google
        </button>

        {/* ── One-time setup section ── */}
        <div style={{ marginTop: '1.5rem', background: '#0f1117', border: '1px solid #2d3148', borderRadius: '8px', overflow: 'hidden' }}>
          <button
            onClick={() => setShowSetup(s => !s)}
            style={{ width: '100%', background: 'none', border: 'none', padding: '.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: '#64748b', fontSize: '.78rem', fontWeight: 600 }}
          >
            <span>⚙️ First time? One-time project setup required</span>
            <span style={{ fontSize: '.7rem', color: '#334155' }}>{showSetup ? '▲ hide' : '▼ show'}</span>
          </button>

          {showSetup && (
            <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid #1e2235' }}>
              <p style={{ color: '#64748b', fontSize: '.78rem', lineHeight: 1.7, marginTop: '.75rem', marginBottom: '.75rem' }}>
                ORION runs queries on your behalf using a service account. Before your first login,
                you need to grant that service account permission to run BigQuery jobs in your project.
                This is a one-time step.
              </p>

              <div style={{ fontSize: '.75rem', color: '#475569', lineHeight: 1.8 }}>
                <strong style={{ color: '#64748b', display: 'block', marginBottom: '.35rem' }}>Step 1 — Enable the BigQuery API</strong>
                <a
                  href={`https://console.cloud.google.com/apis/library/bigquery.googleapis.com${projectId.trim() ? `?project=${projectId.trim()}` : ''}`}
                  target="_blank" rel="noreferrer"
                  style={{ color: '#7c8cff' }}
                >
                  Enable BigQuery API in your project ↗
                </a>
              </div>

              <div style={{ fontSize: '.75rem', color: '#475569', lineHeight: 1.8, marginTop: '.75rem' }}>
                <strong style={{ color: '#64748b', display: 'block', marginBottom: '.35rem' }}>Step 2 — Grant BigQuery Job User role</strong>
                <a href={iamUrl} target="_blank" rel="noreferrer" style={{ color: '#7c8cff' }}>
                  Open IAM for your project ↗
                </a>
                <span style={{ display: 'block', marginTop: '.3rem' }}>
                  Click <strong style={{ color: '#94a3b8' }}>Grant Access</strong>, then:
                </span>
                <div style={{ background: '#1a1d27', border: '1px solid #2d3148', borderRadius: '6px', padding: '.6rem .85rem', marginTop: '.4rem' }}>
                  <div style={{ marginBottom: '.3rem' }}>
                    <span style={{ color: '#475569' }}>New principal: </span>
                    <code style={{ color: '#a78bfa', fontSize: '.72rem', userSelect: 'all' }}>{SERVICE_ACCOUNT}</code>
                  </div>
                  <div>
                    <span style={{ color: '#475569' }}>Role: </span>
                    <code style={{ color: '#4ade80', fontSize: '.72rem' }}>BigQuery Job User</code>
                  </div>
                </div>
              </div>

              <p style={{ color: '#334155', fontSize: '.72rem', lineHeight: 1.6, marginTop: '.75rem', marginBottom: 0 }}>
                This allows ORION to run queries billed to your project. It does <strong style={{ color: '#475569' }}>not</strong> grant
                access to any data in your project — only the ability to submit BigQuery jobs.
              </p>
            </div>
          )}
        </div>

        {/* How to find project ID */}
        <div style={{ marginTop: '.75rem', padding: '1rem', background: '#0f1117', borderRadius: '8px', border: '1px solid #2d3148' }}>
          <p style={{ color: '#475569', fontSize: '.75rem', lineHeight: 1.7, margin: 0 }}>
            <strong style={{ color: '#64748b' }}>How to find your Project ID:</strong><br />
            1. Go to <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" style={{ color: '#7c8cff' }}>console.cloud.google.com</a><br />
            2. Click the project dropdown at the top<br />
            3. Copy the <strong style={{ color: '#64748b' }}>ID</strong> (not the name) — looks like <code style={{ color: '#a78bfa' }}>my-project-123456</code>
          </p>
        </div>

        <p style={{ color: '#334155', fontSize: '.72rem', marginTop: '1rem', lineHeight: 1.5, textAlign: 'center' }}>
          Your Google account is used for identity only. You can revoke access at any time from your{' '}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" style={{ color: '#475569' }}>Google account settings</a>.
        </p>
        <p style={{ color: '#2d3148', fontSize: '.7rem', marginTop: '.75rem', textAlign: 'center' }}>
          Open source · MIT License ·{' '}
          <a href="https://github.com/jpbascur/orion-app" target="_blank" rel="noreferrer" style={{ color: '#334155' }}>
            github.com/jpbascur/orion-app
          </a>
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
