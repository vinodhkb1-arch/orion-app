import React from 'react';

export default function LoginGate() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0f1117',
    }}>
      <div style={{
        background: '#1a1d27',
        border: '1px solid #2d3148',
        borderRadius: '14px',
        padding: '2.5rem',
        width: '100%',
        maxWidth: '380px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '.5rem' }}>⭐</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '.4rem' }}>
          ORION
        </h1>
        <p style={{ color: '#64748b', fontSize: '.875rem', marginBottom: '2rem' }}>
          Research Dashboard
        </p>

        <a
          href="/auth/login"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '.6rem',
            width: '100%',
            background: '#fff',
            color: '#0f1117',
            border: 'none',
            borderRadius: '6px',
            padding: '.65rem',
            fontSize: '.95rem',
            fontWeight: 600,
            cursor: 'pointer',
            textDecoration: 'none',
            boxSizing: 'border-box',
          }}
        >
          <GoogleIcon />
          Sign in with Google
        </a>

        <p style={{
          color: '#334155',
          fontSize: '.72rem',
          marginTop: '1.5rem',
          lineHeight: 1.6,
        }}>
          Your Google account is used for access only.
          You can revoke access at any time from your{' '}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" style={{ color: '#475569' }}>
            Google account settings
          </a>.
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
