// Minimal JSON client for the KLG backend.
// On Android, capacitor.config.json enables CapacitorHttp, which routes fetch()
// through native HTTP. That request carries no Origin header, so the backend's
// CORS allow-list (which rejects the WebView origin https://localhost) is skipped.
import { API_BASE_URL } from '../../config';

const SESSION_KEY = 'klg.session';

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function token() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY))?.token || null; } catch { return null; }
}

export async function api(path, { method = 'GET', body, query, auth = true, timeoutMs = 20000 } = {}) {
  const url = new URL(API_BASE_URL + path);
  if (query) Object.entries(query).forEach(([k, v]) => v != null && v !== '' && url.searchParams.set(k, v));

  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const t = auth ? token() : null;
  if (t) headers.Authorization = `Bearer ${t}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new ApiError(e.name === 'AbortError' ? 'The server took too long to respond.' : 'No connection to the server. Check your internet.', 0);
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try { data = await res.json(); } catch { /* empty or non-JSON body */ }

  if (!res.ok || data?.success === false) {
    const msg = data?.message || `Request failed (${res.status})`;
    if (res.status === 401 && auth) window.dispatchEvent(new CustomEvent('klg:unauthorized', { detail: msg }));
    throw new ApiError(msg, res.status, data);
  }
  return data;
}
