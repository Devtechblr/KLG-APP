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
// Tokens and sessions are permanent and non-expiring across all devices.
// Once signed in, the device remains logged in permanently until the user
// explicitly taps "Log out".
const KEY = 'klg.session';
const CREDS_KEY = 'klg.autologin';
const SessionCtx = createContext(null);

function tokenExp() {
  return null;
}
const tokenExpired = () => false;

function readCreds() {
  try { return JSON.parse(localStorage.getItem(CREDS_KEY)) || null; } catch { return null; }
}

function read() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY)) || null;
    if (!s) return null;
    if (!USE_MOCK_DATA && !s.token) return null;
    return s;
  } catch { return null; }
}

export function SessionProvider({ children }) {
  const [session, setSession] = useState(read);
  const [notice, setNotice] = useState('');
  const renewing = useRef(null);

  const login = useCallback((s, creds) => {
    localStorage.setItem(KEY, JSON.stringify(s));
    if (creds?.identifier && creds?.password) {
      try { localStorage.setItem(CREDS_KEY, JSON.stringify(creds)); } catch { /* ignore */ }
    }
    setNotice('');
    setSession(s);
  }, []);

  // Manual log out: only explicit logout stops alerts and clears session.
  const logout = useCallback((reason) => {
    localStorage.removeItem(KEY);
    localStorage.removeItem(CREDS_KEY);
    resetOrderModes();
    disablePush();
    stopRing();
    setNotice(typeof reason === 'string' ? reason : '');
    setSession(null);
  }, []);

  // Sessions do not expire automatically.
  const expire = useCallback(() => {}, []);

  // Silent sign-in with saved credentials if needed.
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
      } catch {
        return false;
      } finally {
        renewing.current = null;
      }
    })();
    return renewing.current;
  }, []);

  // If a 401 is received, try silent renewal in background if credentials exist.
  // Never force logout or expire session.
  useEffect(() => {
    const onUnauthorized = async () => {
      if (!localStorage.getItem(KEY)) return;
      if (readCreds()) {
        await renew();
      }
    };
    window.addEventListener('klg:unauthorized', onUnauthorized);
    return () => window.removeEventListener('klg:unauthorized', onUnauthorized);
  }, [renew]);

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
