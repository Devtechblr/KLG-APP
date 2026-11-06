// Production data service: talks to the shared KLG backend REST API.
// The backend's source of truth is MongoDB; this app never writes to Firestore directly.
import { api } from './http';
import { buildDb } from './adapters';
import { POLL_MS } from '../../config';

const SESSION_KEY = 'klg.session';
const session = () => { try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; } catch { return null; } };

// ---- Sign-in -------------------------------------------------------------
// POST /admin/login accepts an admin email, or a driver's email / 10-digit phone.
// It returns role 'Driver' for riders; the same JWT works on /rider/* routes.
export async function signIn(identifier, password) {
  const res = await api('/admin/login', { method: 'POST', auth: false, body: { email: identifier.trim(), password } });
  const who = res.admin || {};
  if (who.role === 'Driver') {
    return { role: 'driver', token: res.token, driverId: String(who.id), name: who.name, phone: who.phone, email: who.email };
  }
  return { role: 'admin', token: res.token, adminRole: who.role, adminId: String(who.id), name: who.name || 'Admin', email: who.email };
}

// ---- Loading -------------------------------------------------------------
async function loadAdmin(s) {
  const [orders, riders] = await Promise.all([
    api('/admin/orders', { query: { orderType: 'DELIVERY', limit: 300, page: 1 } }),
    api('/admin/riders'),
  ]);
  return buildDb({
    orders: orders.data || [],
    riders: riders.data || [],
    adminUser: { id: s.adminId, name: s.name, email: s.email, role: s.adminRole },
  });
}

async function loadDriver(s) {
  const [profile, available, active, completed, notifs, stats] = await Promise.all([
    api('/rider/profile'),
    api('/rider/orders/available').catch(() => ({ orders: [] })),
    api('/rider/orders/active'),
    api('/rider/orders/completed').catch(() => ({ orders: [] })),
    api('/rider/notifications').catch(() => ({ notifications: [] })),
    api('/rider/stats').catch(() => null),
  ]);
  const me = profile.rider;
  const db = buildDb({
    orders: [...(completed.orders || []), ...(available.orders || []), ...(active.orders || [])],
    riders: [{ ...me, _id: me.id }],
    meId: String(me.id || s.driverId),
    notifications: notifs.notifications || [],
  });
  db.stats = stats; // { totalRides, totalKm, todaysRides, todaysKm, weekRides, ... } from the server
  return db;
}

// ---- Actions -------------------------------------------------------------
const ADMIN_STATUS_ROUTE = {
  ACCEPTED: 'accept',
  PREPARING: 'preparing',
  PACKING: 'packing',
  READY: 'ready',
  OUT_FOR_DELIVERY: 'out-for-delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancel',
};

async function adminSetStatus(order, status, note) {
  const route = ADMIN_STATUS_ROUTE[status];
  if (!route) throw new Error(`"${status}" can't be set from the app.`);
  await api(`/admin/orders/${order._id}/${route}`, { method: 'PATCH', body: status === 'CANCELLED' ? { reason: note || 'Cancelled by restaurant' } : {} });
}

// Driver steps. RIDER_ACCEPT / RIDER_REJECT are app-only pseudo statuses.
async function driverSetStatus(order, status) {
  const path = `/rider/orders/${encodeURIComponent(order.id)}`;
  if (status === 'RIDER_ACCEPT') return api(`${path}/accept`, { method: 'POST', body: {} });
  if (status === 'RIDER_REJECT') return api(`${path}/reject`, { method: 'POST', body: {} });
  if (status === 'OUT_FOR_DELIVERY') return api(`${path}/start`, { method: 'POST', body: {} });
  if (status === 'DELIVERED') return api(`${path}/complete`, { method: 'POST', body: {} });
  throw new Error('This step is done by the restaurant.');
}

export const apiService = {
  mode: 'api',

  async loadAll() {
    const s = session();
    if (!s?.token) return buildDb({});
    return s.role === 'driver' ? loadDriver(s) : loadAdmin(s);
  },

  // Live updates: re-read every POLL_MS while the app is visible.
  subscribe(onChange, onError) {
    let stopped = false;
    let busy = false;
    const tick = async () => {
      const s = session();
      // Keeps polling while the app is in the background, so a new order rings
      // within one poll even if the server's push is late or missing.
      if (stopped || busy || !s?.token) return;
      busy = true;
      try { onChange(await apiService.loadAll()); } catch (e) { onError?.(e); } finally { busy = false; }
    };
    const id = setInterval(tick, POLL_MS);
    const onVis = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVis);
    return () => { stopped = true; clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  },

  async save() { return true; }, // writes go through the specific actions below
  async reset() { return apiService.loadAll(); },

  actions: {
    setStatus: (order, status, note) => (session()?.role === 'driver' ? driverSetStatus(order, status) : adminSetStatus(order, status, note)),
    assignDriver: (order, driverId) => api(`/admin/orders/${order._id}/assign-rider`, { method: 'PATCH', body: { riderId: driverId, mode: 'MANUAL' } }),
    autoAssign: (order) => api(`/admin/orders/${order._id}/assign-rider`, { method: 'PATCH', body: { mode: 'AUTO' } }),
    upsertDriver: (d) => {
      const body = { name: d.name, phone: d.phone, vehicleNumber: d.vehicleNo, status: d.online ? 'AVAILABLE' : 'OFFLINE' };
      if (d.email) body.email = d.email;
      if (d.password) body.password = d.password;
      return d.id ? api(`/admin/riders/${d.id}`, { method: 'PUT', body }) : api('/admin/riders', { method: 'POST', body });
    },
    toggleDriverOnline: (driver) => (session()?.role === 'driver'
      ? api('/rider/status', { method: 'PATCH', body: { status: driver.online ? 'OFFLINE' : 'AVAILABLE' } })
      : api(`/admin/riders/${driver.id}/status`, { method: 'PATCH', body: { status: driver.online ? 'OFFLINE' : 'AVAILABLE' } })),
    markNotificationRead: (id) => api(`/rider/notifications/${id}/read`, { method: 'POST', body: {} }),
    sendLocation: (order, coords) => api(`/rider/orders/${encodeURIComponent(order.id)}/location`, {
      method: 'POST', body: { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy },
    }),
  },
};
