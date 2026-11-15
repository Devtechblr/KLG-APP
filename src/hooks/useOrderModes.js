// Delivery / Self Order (Pickup) ON-OFF switches, shared by the top bar and
// Settings. Same setting as the admin website's Settings → Operating Hours.
import { useEffect, useSyncExternalStore } from 'react';
import { apiService } from '../services/api/apiService';
import { friendlyError } from '../utils/errors';
import { USE_MOCK_DATA } from '../config';

let state = { modes: null, error: '', busy: '' };
let loading = null;
const subs = new Set();
const emit = (patch) => { state = { ...state, ...patch }; subs.forEach((f) => f()); };
const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };

function errorText(e) {
  if (e.status === 403) return 'Your login cannot change ordering. Ask an Admin.';
  if (e.status === 404) return 'Needs the latest KLG server update.';
  return friendlyError(e);
}

export function loadOrderModes() {
  if (USE_MOCK_DATA) return Promise.resolve(); // demo mode: no server
  if (loading) return loading;
  loading = apiService.actions.getOrderModes()
    .then((modes) => emit({ modes, error: '' }))
    .catch((e) => { if (!state.modes) emit({ error: errorText(e) }); })
    .finally(() => { loading = null; });
  return loading;
}

// Resolves to null on success, or an error message.
export async function setOrderMode(mode, on) {
  emit({ busy: mode });
  try {
    const modes = await apiService.actions.setOrderMode(mode, on);
    emit({ modes: modes || { ...state.modes, [mode]: on }, busy: '' });
    return null;
  } catch (e) {
    emit({ busy: '' });
    return errorText(e);
  }
}

export function resetOrderModes() { loading = null; emit({ modes: null, error: '', busy: '' }); }

export default function useOrderModes() {
  const s = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    loadOrderModes();
    // Someone may flip it on the admin website: re-read when the app comes back.
    const onVisible = () => document.visibilityState === 'visible' && loadOrderModes();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
  return s;
}
