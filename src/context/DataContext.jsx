import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { dataService } from '../services';
import { STATUS } from '../utils/status';
import { useSession } from './SessionContext';
import { notifyNewWork } from '../services/native/notifications';

const DataCtx = createContext(null);
const UiCtx = createContext(null);

const API = dataService.mode === 'api';

export function DataProvider({ children }) {
  const { session } = useSession();
  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const dbRef = useRef(null);

  const toast = useCallback((message, tone = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  const confirm = useCallback(
    (opts) => new Promise((resolve) => setConfirmState({ ...opts, resolve })),
    []
  );

  const apply = useCallback((data) => {
    if (API) notifyNewWork(dbRef.current, data, session);
    dbRef.current = data;
    setDb(data);
  }, [session]);

  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      apply(await dataService.loadAll());
    } catch (e) {
      if (!silent || !dbRef.current) setError(e.message);
      else throw e;
    } finally {
      setLoading(false);
    }
  }, [apply]);

  const sessionKey = session ? `${session.role}:${session.driverId || session.adminId || ''}` : '';
  useEffect(() => {
    dbRef.current = null;
    setDb(null);
    if (API && !sessionKey) { setLoading(false); return undefined; }
    load();
    if (typeof dataService.subscribe === 'function') {
      const unsub = dataService.subscribe(apply, () => { /* keep last good data; next tick retries */ });
      return () => unsub && unsub();
    }
    return undefined;
  }, [load, apply, sessionKey]);

  const commit = useCallback((mutator) => {
    const next = structuredClone(dbRef.current);
    mutator(next);
    dbRef.current = next;
    setDb(next);
    dataService.save(next).catch((e) => toast(e.message, 'danger'));
  }, [toast]);

  // API mode: call the backend, then re-read so the screen shows the server's truth.
  const run = useCallback(async (fn, okMsg) => {
    try {
      await fn();
      if (okMsg) toast(okMsg);
    } catch (e) {
      toast(e.message || 'Something went wrong', 'danger');
      return false;
    } finally {
      try { await load(true); } catch { /* shown on next poll */ }
    }
    return true;
  }, [load, toast]);

  const apiActions = useMemo(() => {
    const a = dataService.actions || {};
    const orderOf = (id) => dbRef.current?.orders.find((o) => o.id === id);
    const driverOf = (id) => dbRef.current?.drivers.find((d) => d.id === id);
    const label = (s) => STATUS[s]?.label || { RIDER_ACCEPT: 'Accepted', RIDER_REJECT: 'Declined' }[s] || s;
    return {
      refresh: async () => { setLoading(true); try { await load(true); toast('Updated'); } catch (e) { toast(e.message, 'danger'); } setLoading(false); },
      reset: async () => { await load(); },
      setStatus: (orderId, status, note) => run(() => a.setStatus(orderOf(orderId), status, note), `${orderId} → ${label(status)}`),
      assignDriver: (orderId, driverId) => run(() => a.assignDriver(orderOf(orderId), driverId), `Assigned ${driverOf(driverId)?.name || 'driver'}`),
      autoAssign: (orderId) => run(() => a.autoAssign(orderOf(orderId)), 'Offered to all online drivers'),
      upsertDriver: (driver) => run(() => a.upsertDriver(driver), driver.id ? 'Driver updated' : 'Driver added'),
      toggleDriverOnline: (id) => {
        const d = driverOf(id);
        return run(() => a.toggleDriverOnline(d), `${d?.name} is now ${d?.online ? 'offline' : 'online'}`);
      },
      markNotificationRead: (id) => a.markNotificationRead?.(id).catch(() => null),
      sendLocation: (orderId, coords) => a.sendLocation?.(orderOf(orderId), coords).catch(() => null),
      upsertMenuItem: () => toast('Menu is managed on the website', 'info'),
      toggleMenuItem: () => toast('Menu is managed on the website', 'info'),
    };
  }, [load, run, toast]);

  const mockActions = useMemo(() => ({
    refresh: async () => {
      setLoading(true);
      await load(true);
      toast('Data refreshed');
    },
    reset: async () => {
      setLoading(true);
      try {
        const data = await dataService.reset();
        dbRef.current = data;
        setDb(data);
        toast('Demo data reset');
      } catch (e) { toast(e.message, 'danger'); }
      setLoading(false);
    },
    setStatus: (orderId, status, note = '') => commit((d) => {
      const o = d.orders.find((x) => x.id === orderId);
      if (!o) return;
      // A pre-assigned driver means a "ready" order is immediately handed over.
      if (status === 'READY' && o.driverId) status = 'ASSIGNED';
      o.status = status;
      if (status === 'DELIVERED' && o.paymentMethod === 'COD') o.paymentStatus = 'PAID';
      if (status === 'CANCELLED' && o.paymentStatus === 'PAID') o.paymentStatus = 'REFUNDED';
      o.timeline.push({ status, at: new Date().toISOString(), note });
      toast(`${orderId} → ${STATUS[status].label}`);
    }),
    assignDriver: (orderId, driverId) => commit((d) => {
      const o = d.orders.find((x) => x.id === orderId);
      const dr = d.drivers.find((x) => x.id === driverId);
      if (!o || !dr) return;
      const re = !!o.driverId;
      o.driverId = driverId;
      if (['PENDING', 'ACCEPTED', 'PREPARING', 'READY'].includes(o.status)) {
        // Assigning before ready keeps kitchen status; only READY moves to ASSIGNED.
        if (o.status === 'READY') o.status = 'ASSIGNED';
      }
      o.timeline.push({ status: o.status === 'ASSIGNED' ? 'ASSIGNED' : o.status, at: new Date().toISOString(), note: `${re ? 'Reassigned' : 'Assigned'} to ${dr.name}` });
      toast(`${re ? 'Reassigned' : 'Assigned'} ${dr.name}`);
    }),
    upsertDriver: (driver) => commit((d) => {
      const i = d.drivers.findIndex((x) => x.id === driver.id);
      if (i >= 0) d.drivers[i] = { ...d.drivers[i], ...driver };
      else d.drivers.push({ ...driver, id: 'd' + Date.now(), joinedAt: new Date().toISOString().slice(0, 10), rating: 5 });
      toast(i >= 0 ? 'Driver updated' : 'Driver added');
    }),
    toggleDriverOnline: (id) => commit((d) => {
      const dr = d.drivers.find((x) => x.id === id);
      dr.online = !dr.online;
      toast(`${dr.name} is now ${dr.online ? 'online' : 'offline'}`);
    }),
    upsertMenuItem: (item) => commit((d) => {
      const i = d.menu.findIndex((x) => x.id === item.id);
      if (i >= 0) d.menu[i] = { ...d.menu[i], ...item };
      else d.menu.push({ ...item, id: 'm' + Date.now() });
      toast(i >= 0 ? 'Item updated' : 'Item added');
    }),
    toggleMenuItem: (id) => commit((d) => {
      const m = d.menu.find((x) => x.id === id);
      m.available = !m.available;
      toast(`${m.name} ${m.available ? 'available' : 'marked unavailable'}`, m.available ? 'success' : 'warning');
    }),
  }), [commit, load, toast]);

  const actions = API ? apiActions : mockActions;

  const lookups = useMemo(() => {
    if (!db) return null;
    const customerById = Object.fromEntries(db.customers.map((c) => [c.id, c]));
    const driverById = Object.fromEntries(db.drivers.map((d) => [d.id, d]));
    return { customerById, driverById };
  }, [db]);

  return (
    <UiCtx.Provider value={{ toast, confirm, toasts, confirmState, setConfirmState }}>
      <DataCtx.Provider value={{ db, loading, error, actions, ...lookups, mode: dataService.mode }}>
        {children}
      </DataCtx.Provider>
    </UiCtx.Provider>
  );
}

export const useData = () => useContext(DataCtx);
export const useUi = () => useContext(UiCtx);
