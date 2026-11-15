import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { disablePush, enableAdminPush, enableDriverPush, stopRing } from '../services/native/notifications';
import { signIn } from '../services/api/apiService';
import { resetOrderModes } from '../hooks/useOrderModes';
import { USE_MOCK_DATA } from '../config';

// Who is using the app.
//   admin:  { role: 'admin', token, adminRole, adminId, name, email }
//   driver: { role: 'driver', token, driverId, name, phone, email }
// In demo mode there is no token and nothing is sent anywhere.
//
// The backend's login token expires after 24 h. The restaurant phone stays
// open for days, so the app signs in again by itself before / when the token
// expires (with the sign-in details saved on this phone at login). Only a
// manual "Log out" stops the order alerts: an expired session never does,
// otherwise the next day's orders would not ring.
const KEY = 'klg.session';
const CREDS_KEY = 'klg.autologin';
const RENEW_BEFORE_MS = 2 * 60 * 60_000; // renew when < 2 h left
const CHECK_EVERY_MS = 10 * 60_000;
const SessionCtx = createContext(null);

function tokenExp(token) {
  try {
    const { exp } = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return exp ? exp * 1000 : null;
  } catch { return null; }
}
const tokenExpired = (token) => { const e = tokenExp(token); return e ? e < Date.now() : false; };

function readCreds() {
  try { return JSON.parse(localStorage.getItem(CREDS_KEY)) || null; } catch { return null; }
}

function read() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY)) || null;
    if (!s) return null;
    if (!USE_MOCK_DATA && !s.token) { localStorage.removeItem(KEY); return null; }
    // Expired but we can sign in again: keep the session, renewal runs on mount.
    if (!USE_MOCK_DATA && tokenExpired(s.token) && !readCreds()) { localStorage.removeItem(KEY); return null; }
    return s;
  } catch { return null; }
}

export function SessionProvider({ children }) {
  const [session, setSession] = useState(read);
  const [notice, setNotice] = useState('');
  const renewing = useRef(null);
  const lastTimedRenew = useRef(0);

  const login = useCallback((s, creds) => {
    localStorage.setItem(KEY, JSON.stringify(s));
    if (creds?.identifier && creds?.password) {
      try { localStorage.setItem(CREDS_KEY, JSON.stringify(creds)); } catch { /* ignore */ }
    }
    setNotice('');
    setSession(s);
  }, []);

  // Manual log out: stop alerts and forget the saved sign-in.
  const logout = useCallback((reason) => {
    localStorage.removeItem(KEY);
    localStorage.removeItem(CREDS_KEY);
    resetOrderModes();
    disablePush();
    stopRing();
    setNotice(typeof reason === 'string' ? reason : '');
    setSession(null);
  }, []);

  // Session ended by the server (expired token, password changed): back to
  // sign-in, but the phone keeps its order alerts (FCM push) switched on.
  const expire = useCallback((reason) => {
    localStorage.removeItem(KEY);
    resetOrderModes();
    setNotice(reason);
    setSession(null);
  }, []);

  // Sign in again with the saved details. One attempt at a time.
  const renew = useCallback(() => {
    if (USE_MOCK_DATA) return Promise.resolve(false);
    if (renewing.current) return renewing.current;
    const creds = readCreds();
    if (!creds) return Promise.resolve(false);
    renewing.current = (async () => {
      try {
        const s = await signIn(creds.identifier, creds.password);
        localStorage.setItem(KEY, JSON.stringify(s));
        setSession(s);
        return true;
      } catch (e) {
        if (e.status === 401) {
          localStorage.removeItem(CREDS_KEY); // password changed
          expire('Your password was changed. Please sign in again.');
        }
        return false; // offline / server down: try again later
      } finally {
        renewing.current = null;
      }
    })();
    return renewing.current;
  }, [expire]);

  // Backend said 401 → sign in again silently; only if that is impossible go to sign-in.
  useEffect(() => {
    const onUnauthorized = async () => {
      if (!localStorage.getItem(KEY)) return; // already signed out: late 401s change nothing
      // No saved sign-in at all → back to sign-in. (If there was one and it no
      // longer works, renew() already showed "password was changed".)
      if (!readCreds()) { expire('Your session expired. Please sign in again.'); return; }
      await renew();
    };
    window.addEventListener('klg:unauthorized', onUnauthorized);
    return () => window.removeEventListener('klg:unauthorized', onUnauthorized);
  }, [renew, expire]);

  // Renew before the token runs out: on start, every 10 min, and when the app comes back.
  useEffect(() => {
    if (USE_MOCK_DATA || !session?.token) return;
    const check = () => {
      const exp = tokenExp(session.token);
      // At most one timed renewal per 10 min, so a short-lived token can never
      // cause a sign-in loop. A 401 from the server still renews right away.
      if (!exp || exp - Date.now() >= RENEW_BEFORE_MS) return;
      if (Date.now() - lastTimedRenew.current < CHECK_EVERY_MS) return;
      lastTimedRenew.current = Date.now();
      renew();
    };
    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [session, renew]);

  // Admin phones get the restaurant's new-order push; driver phones register
  // with their login and get only their own offers/assignments.
  useEffect(() => {
    if (USE_MOCK_DATA || !session) return;
    if (session.role === 'admin') enableAdminPush();
    else if (session.role === 'driver') enableDriverPush(session.token);
  }, [session]);

  return <SessionCtx.Provider value={{ session, login, logout, notice }}>{children}</SessionCtx.Provider>;
}

export const useSession = () => useContext(SessionCtx);
