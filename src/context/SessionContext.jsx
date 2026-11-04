import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { disablePush, enableAdminPush, stopRing } from '../services/native/notifications';
import { USE_MOCK_DATA } from '../config';

// Who is using the app.
//   admin:  { role: 'admin', token, adminRole, adminId, name, email }
//   driver: { role: 'driver', token, driverId, name, phone, email }
// In demo mode there is no token and nothing is sent anywhere.
const KEY = 'klg.session';
const SessionCtx = createContext(null);

function tokenExpired(token) {
  try {
    const { exp } = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return exp ? exp * 1000 < Date.now() : false;
  } catch { return false; }
}

function read() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY)) || null;
    if (!s) return null;
    if (!USE_MOCK_DATA && (!s.token || tokenExpired(s.token))) { localStorage.removeItem(KEY); return null; }
    return s;
  } catch { return null; }
}

export function SessionProvider({ children }) {
  const [session, setSession] = useState(read);
  const [notice, setNotice] = useState('');

  const login = useCallback((s) => {
    localStorage.setItem(KEY, JSON.stringify(s));
    setNotice('');
    setSession(s);
  }, []);

  const logout = useCallback((reason) => {
    localStorage.removeItem(KEY);
    disablePush();
    stopRing();
    setNotice(typeof reason === 'string' ? reason : '');
    setSession(null);
  }, []);

  // Backend said 401 (token expired / revoked) → back to sign-in.
  useEffect(() => {
    const onUnauthorized = () => logout('Your session expired. Please sign in again.');
    window.addEventListener('klg:unauthorized', onUnauthorized);
    return () => window.removeEventListener('klg:unauthorized', onUnauthorized);
  }, [logout]);

  // Admin phones receive the backend's new-order push; driver phones must not
  // (the backend pushes every new order to every registered device).
  useEffect(() => {
    if (USE_MOCK_DATA || !session) return;
    if (session.role === 'admin') enableAdminPush();
    else disablePush();
  }, [session]);

  return <SessionCtx.Provider value={{ session, login, logout, notice }}>{children}</SessionCtx.Provider>;
}

export const useSession = () => useContext(SessionCtx);
