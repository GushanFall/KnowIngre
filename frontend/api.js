// ===== API & Auth =====
export const API_BASE = window.location.origin;
const TOKEN_KEY = 'knowingre_token';
export const USER_KEY = 'knowingre_user';

function sanitizeHeader(s) {
  // Headers only allow ISO-8859-1, strip anything outside that range
  return s.replace(/[^\x00-\xFF]/g, '').trim();
}

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }

export async function apiResponse(path, options = {}) {
  const token = getToken();
  const headers = {};
  if (options.headers) {
    for (const [k, v] of Object.entries(options.headers)) {
      headers[k] = sanitizeHeader(String(v));
    }
  }
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (options.body && typeof options.body === 'object') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  const resp = await fetch(API_BASE + path, { ...options, headers });
  if (resp.status === 401) { clearToken(); window.location.href = '/login.html'; throw new Error('未登录'); }
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: '请求失败' }));
    throw new Error(err.error || `HTTP ${resp.status}`);
  }
  return resp;
}

export async function apiFetch(path, options = {}) {
  return (await apiResponse(path, options)).json();
}
