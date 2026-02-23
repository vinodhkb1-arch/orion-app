/**
 * Thin fetch wrapper — if the backend returns 401 (session expired or missing),
 * redirect to the login page automatically.
 */
export async function apiFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (res.status === 401) {
    window.location.href = '/';   // LoginGate will be shown by App.js /auth/me check
    return null;
  }
  if (!res.ok) throw new Error(res.status);
  return res.json();
}
