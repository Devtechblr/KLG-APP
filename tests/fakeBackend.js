// In-memory stand-in for the KLG backend (klg/backend/functions/src).
// Routes, response shapes and business rules mirror the real controllers:
//   adminAuthController.login, adminOrderController (+ orderStatusService transitions),
//   adminRiderController, riderAuthController, riderOrderController, deviceTokenController.
// Install with installFakeBackend(); it replaces global fetch.
import { vi } from 'vitest';

const BASE = 'https://api.test/api';

const DELIVERY_TRANSITIONS = {
  PENDING: ['ACCEPTED', 'PREPARING', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'OUT_FOR_DELIVERY', 'CANCELLED'],
  PREPARING: ['READY', 'PACKING', 'OUT_FOR_DELIVERY', 'CANCELLED'],
  PACKING: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  READY: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};
const ADMIN_ROUTE_STATUS = {
  accept: 'ACCEPTED', preparing: 'PREPARING', packing: 'PACKING', ready: 'READY',
  'out-for-delivery': 'OUT_FOR_DELIVERY', delivered: 'DELIVERED', cancel: 'CANCELLED',
};
const RIDER_ACTIVE = ['ACCEPTED', 'PREPARING', 'PACKING', 'READY', 'OUT_FOR_DELIVERY'];

const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '');
const now = () => new Date().toISOString();

export function makeOrder(over = {}) {
  const n = over.n ?? Math.floor(Math.random() * 9000 + 1000);
  return {
    _id: `oid${n}`,
    orderId: `KLG-T${n}`,
    orderType: 'DELIVERY',
    orderStatus: 'PENDING',
    riderId: null,
    riderName: null,
    riderPhone: null,
    riderAcceptedAt: null,
    assignmentMode: 'MANUAL',
    offeredRiderIds: [],
    rejectedRiderIds: [],
    items: [{ productId: 'p1', name: 'Masala Dosa', price: 90, quantity: 2, subtotal: 180 }],
    subtotal: 180,
    parcelCharge: 10,
    deliveryCharge: 30,
    gstAmount: 9,
    totalAmount: 229,
    paymentMode: 'COD',
    paymentStatus: 'UNPAID',
    isPaid: false,
    deliveryDetails: { fullName: 'Asha Rao', phoneNumber: '9876500001', address: '12 MG Road', city: 'Bengaluru', latitude: 12.97, longitude: 77.59 },
    statusHistory: [{ status: 'PENDING', updatedAt: now(), updatedBy: 'SYSTEM' }],
    createdAt: now(),
    pendingAt: now(),
    updatedAt: now(),
    ...over,
  };
}

export function createBackend() {
  const state = {
    admins: [{ _id: 'a1', name: 'Front Desk', email: 'desk@klg.test', password: 'desk-pass', role: 'Delivery' },
             { _id: 'a2', name: 'Kitchen', email: 'kitchen@klg.test', password: 'kitchen-pass', role: 'Self' }],
    riders: [
      { _id: 'r1', name: 'Ravi Driver', email: 'ravi@klg.test', phone: '9000000001', password: 'ravi-pass', status: 'AVAILABLE', vehicleNumber: 'KA01AB1234', createdAt: now() },
      { _id: 'r2', name: 'Sita Driver', email: 'sita@klg.test', phone: '9000000002', password: 'sita-pass', status: 'OFFLINE', vehicleNumber: 'KA02CD5678', createdAt: now() },
    ],
    orders: [],
    notifications: [],
    deviceTokens: [],
    tokens: new Map(), // token -> { kind: 'admin'|'rider', id }
    calls: [],
  };

  const sign = (kind, id, role, ttlSec = 3600) => {
    const t = `${b64({ alg: 'none' })}.${b64({ kind, id, role, exp: Math.floor(Date.now() / 1000) + ttlSec })}.sig`;
    state.tokens.set(t, { kind, id });
    return t;
  };
  const rider = (id) => state.riders.find((r) => r._id === String(id));
  const publicRider = (r) => ({ id: r._id, _id: r._id, name: r.name, email: r.email, phone: r.phone, status: r.status, vehicleNumber: r.vehicleNumber, createdAt: r.createdAt });
  const ok = (body, status = 200) => ({ status, body: { success: true, ...body } });
  const fail = (status, message) => ({ status, body: { success: false, message } });
  const push = (o, status, by) => o.statusHistory.push({ status, updatedAt: now(), updatedBy: by });

  function route(method, path, query, body, auth) {
    // ---- public
    if (method === 'POST' && path === '/admin/login') {
      const id = String(body.email || '').toLowerCase().trim();
      const pw = String(body.password || '').trim();
      const a = state.admins.find((x) => x.email === id);
      if (a) {
        if (a.password !== pw) return fail(401, 'Invalid credentials');
        return ok({ token: sign('admin', a._id, a.role), admin: { id: a._id, name: a.name, email: a.email, role: a.role } });
      }
      const digits = id.replace(/\D/g, '');
      const r = state.riders.find((x) => x.email === id || (digits.length === 10 && x.phone === digits));
      if (!r || r.password !== pw) return fail(401, 'Invalid credentials');
      return ok({ token: sign('rider', r._id, 'Driver'), admin: { id: r._id, name: r.name, email: r.email, phone: r.phone, role: 'Driver' } });
    }
    if (method === 'POST' && path === '/public/device-tokens') {
      if (!body.token || String(body.token).length < 20) return fail(400, 'A valid FCM token is required');
      state.deviceTokens.push(body.token);
      return ok({});
    }

    // ---- admin
    if (path.startsWith('/admin/')) {
      if (!auth || auth.kind !== 'admin') return fail(401, 'Unauthorized: Token required');
      if (method === 'GET' && path === '/admin/orders') {
        let list = state.orders.filter((o) => o.orderStatus !== 'DRAFT');
        if (query.orderType) list = list.filter((o) => o.orderType === query.orderType);
        list = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return ok({ data: list, pagination: { total: list.length, page: 1, limit: Number(query.limit || 10), pages: 1 } });
      }
      if (method === 'GET' && path === '/admin/riders') return ok({ data: state.riders.map(publicRider) });
      if (method === 'POST' && path === '/admin/riders') {
        const phone = String(body.phone || '').replace(/\D/g, '');
        if (!body.name) return fail(400, 'Rider Name is required');
        if (phone.length !== 10) return fail(400, 'Phone number must be exactly 10 digits.');
        if (state.riders.some((r) => r.phone === phone)) return fail(400, 'A rider with this phone number already exists.');
        const r = { _id: `r${state.riders.length + 1}`, name: body.name, email: body.email || '', phone, password: body.password || 'random', status: body.status || 'AVAILABLE', vehicleNumber: body.vehicleNumber || '', createdAt: now() };
        state.riders.push(r);
        return ok({ data: publicRider(r) }, 201);
      }
      let m = path.match(/^\/admin\/riders\/([^/]+)$/);
      if (m && method === 'PUT') {
        const r = rider(m[1]);
        if (!r) return fail(404, 'Rider not found');
        Object.assign(r, { name: body.name ?? r.name, phone: body.phone ?? r.phone, vehicleNumber: body.vehicleNumber ?? r.vehicleNumber });
        if (body.password) r.password = body.password;
        if (['AVAILABLE', 'BUSY', 'OFFLINE'].includes(body.status)) r.status = body.status;
        return ok({ data: publicRider(r) });
      }
      m = path.match(/^\/admin\/riders\/([^/]+)\/status$/);
      if (m && method === 'PATCH') {
        const r = rider(m[1]);
        if (!r) return fail(404, 'Rider not found');
        r.status = ['AVAILABLE', 'BUSY', 'OFFLINE'].includes(body.status) ? body.status : (r.status === 'OFFLINE' ? 'AVAILABLE' : 'OFFLINE');
        return ok({ message: `Rider status updated to ${r.status}` });
      }
      m = path.match(/^\/admin\/orders\/([^/]+)\/assign-rider$/);
      if (m && method === 'PATCH') {
        const o = state.orders.find((x) => x._id === m[1]);
        if (!o) return fail(404, 'Order not found');
        if (body.mode === 'AUTO') {
          const busy = new Set(state.orders.filter((x) => ['ACCEPTED', 'OUT_FOR_DELIVERY'].includes(x.orderStatus) && x.riderId).map((x) => x.riderId));
          const avail = state.riders.filter((r) => r.status !== 'OFFLINE' && !busy.has(r._id));
          Object.assign(o, { assignmentMode: 'AUTO', offeredRiderIds: avail.map((r) => r._id), rejectedRiderIds: [], riderId: null, riderName: null, riderPhone: null, riderAcceptedAt: null });
          avail.forEach((r) => state.notifications.push({ _id: `n${state.notifications.length + 1}`, riderId: r._id, orderId: o.orderId, title: 'New Delivery Offer Available', type: 'AUTO_OFFER', read: false }));
          return ok({ data: o });
        }
        const r = rider(body.riderId);
        if (!r) return fail(400, 'Selected driver not found.');
        if (r.status === 'OFFLINE') return fail(400, `${r.name} is currently offline.`);
        Object.assign(o, { riderId: r._id, riderName: r.name, riderPhone: r.phone, assignmentMode: 'MANUAL', offeredRiderIds: [r._id], rejectedRiderIds: [], riderAcceptedAt: null });
        state.notifications.push({ _id: `n${state.notifications.length + 1}`, riderId: r._id, orderId: o.orderId, title: 'New Delivery Assigned to You', type: 'MANUAL_ASSIGNMENT', read: false });
        return ok({ data: o });
      }
      m = path.match(/^\/admin\/orders\/([^/]+)\/([a-z-]+)$/);
      if (m && method === 'PATCH' && ADMIN_ROUTE_STATUS[m[2]]) {
        const o = state.orders.find((x) => x._id === m[1]);
        if (!o) return fail(404, 'Order not found');
        const next = ADMIN_ROUTE_STATUS[m[2]];
        if (!DELIVERY_TRANSITIONS[o.orderStatus]?.includes(next)) {
          return fail(400, `Cannot transition from ${o.orderStatus} to ${next}. Valid transitions from ${o.orderStatus}: ${DELIVERY_TRANSITIONS[o.orderStatus].join(', ')}`);
        }
        o.orderStatus = next;
        if (next === 'CANCELLED') o.cancellationReason = body.reason || '';
        if (next === 'DELIVERED') o.deliveredAt = now();
        push(o, next, 'ADMIN');
        return ok({ data: o });
      }
      return fail(404, `No fake route for ${method} ${path}`);
    }

    // ---- rider
    if (path.startsWith('/rider/')) {
      if (!auth || auth.kind !== 'rider') return fail(401, 'Unauthorized: Rider token required');
      const me = rider(auth.id);
      const mine = (o) => o.riderId === me._id;
      if (method === 'GET' && path === '/rider/profile') return ok({ rider: publicRider(me) });
      if (method === 'PATCH' && path === '/rider/status') {
        if (!['AVAILABLE', 'OFFLINE'].includes(body.status)) return fail(400, 'Status must be AVAILABLE or OFFLINE');
        if (me.status === 'BUSY' && body.status === 'OFFLINE') return fail(400, 'Cannot go offline while on an active delivery');
        me.status = body.status;
        return ok({ status: me.status });
      }
      if (method === 'GET' && path === '/rider/orders/available') {
        const hasActive = state.orders.some((o) => mine(o) && RIDER_ACTIVE.includes(o.orderStatus) && o.riderAcceptedAt);
        const eligible = me.status === 'AVAILABLE' && !hasActive;
        const list = state.orders.filter((o) => o.orderType === 'DELIVERY' && ['ACCEPTED', 'PREPARING', 'PACKING', 'READY'].includes(o.orderStatus) &&
          (mine(o) || (eligible && o.assignmentMode === 'AUTO' && !o.riderId && !o.rejectedRiderIds.includes(me._id))));
        return ok({ orders: list.filter((o) => !o.statusHistory.some((h) => h.updatedBy === `RIDER_${me.email}`)) });
      }
      if (method === 'GET' && path === '/rider/orders/active') {
        return ok({ orders: state.orders.filter((o) => mine(o) && RIDER_ACTIVE.includes(o.orderStatus) && (o.riderAcceptedAt || o.orderStatus === 'OUT_FOR_DELIVERY')) });
      }
      if (method === 'GET' && path === '/rider/orders/completed') return ok({ orders: state.orders.filter((o) => mine(o) && o.orderStatus === 'DELIVERED') });
      if (method === 'GET' && path === '/rider/notifications') {
        const list = state.notifications.filter((n) => n.riderId === me._id);
        return ok({ notifications: list, unreadCount: list.filter((n) => !n.read).length });
      }
      if (method === 'GET' && path === '/rider/stats') {
        const done = state.orders.filter((o) => mine(o) && o.orderStatus === 'DELIVERED');
        return ok({ totalRides: done.length, totalKm: 0, todaysRides: done.length, todaysKm: 0, weekRides: done.length, weekKm: 0, monthRides: done.length, monthKm: 0 });
      }
      let m = path.match(/^\/rider\/notifications\/([^/]+)\/read$/);
      if (m && method === 'POST') {
        const n = state.notifications.find((x) => x._id === m[1] && x.riderId === me._id);
        if (n) n.read = true;
        return ok({ message: 'Notification marked as read' });
      }
      m = path.match(/^\/rider\/orders\/([^/]+)\/(accept|reject|start|complete|location)$/);
      if (m && method === 'POST') {
        const o = state.orders.find((x) => x.orderId === decodeURIComponent(m[1]));
        if (!o) return fail(404, 'Order not found');
        const act = m[2];
        if (act === 'accept') {
          const other = state.orders.find((x) => mine(x) && RIDER_ACTIVE.includes(x.orderStatus) && x.riderAcceptedAt && x.orderId !== o.orderId);
          if (other) return fail(400, 'You already have an active delivery. Please complete your current delivery before accepting a new one.');
          if (me.status !== 'AVAILABLE') return fail(400, 'You must be ONLINE and AVAILABLE to accept deliveries.');
          const can = ['ACCEPTED', 'PREPARING', 'PACKING', 'READY'].includes(o.orderStatus) &&
            (mine(o) || (o.assignmentMode === 'AUTO' && !o.riderId && !o.rejectedRiderIds.includes(me._id)));
          if (!can) return fail(400, 'This delivery has already been accepted by another driver or is unavailable.');
          Object.assign(o, { riderId: me._id, riderName: me.name, riderPhone: me.phone, riderAcceptedAt: now() });
          push(o, 'ACCEPTED', `RIDER_${me.email}`);
          me.status = 'BUSY';
          return ok({ order: o, message: 'Order accepted successfully' });
        }
        if (act === 'reject') {
          if (o.riderId || o.assignmentMode !== 'AUTO' || o.rejectedRiderIds.includes(me._id)) return fail(400, 'Order is no longer available to reject or has already been accepted.');
          o.rejectedRiderIds.push(me._id);
          return ok({ message: 'Offer declined' });
        }
        if (!mine(o)) return fail(403, 'Access Denied: This order is not assigned to you');
        if (act === 'start') {
          if (!o.riderAcceptedAt) return fail(400, 'Accept this delivery before starting it.');
          o.orderStatus = 'OUT_FOR_DELIVERY';
          o.outForDeliveryAt = now();
          push(o, 'OUT_FOR_DELIVERY', `RIDER_${me.email}`);
          return ok({ order: o });
        }
        if (act === 'complete') {
          o.orderStatus = 'DELIVERED';
          o.deliveredAt = now();
          push(o, 'DELIVERED', `RIDER_${me.email}`);
          me.status = 'AVAILABLE';
          return ok({ order: o });
        }
        if (act === 'location') {
          if (o.orderStatus !== 'OUT_FOR_DELIVERY') return fail(400, 'Location tracking is active only when delivery is OUT_FOR_DELIVERY');
          o.deliveryTracking = { latitude: body.latitude, longitude: body.longitude, accuracy: body.accuracy ?? null, updatedAt: now() };
          return ok({ deliveryTracking: o.deliveryTracking });
        }
      }
      return fail(404, `No fake route for ${method} ${path}`);
    }
    return fail(404, `No fake route for ${method} ${path}`);
  }

  async function fetchImpl(input, init = {}) {
    const url = new URL(typeof input === 'string' ? input : input.url);
    if (!url.href.startsWith(BASE)) throw new TypeError(`Unexpected request to ${url.href}`);
    const path = url.pathname.replace(/^\/api/, '');
    const method = (init.method || 'GET').toUpperCase();
    const body = init.body ? JSON.parse(init.body) : {};
    const header = init.headers?.Authorization || init.headers?.authorization || '';
    const token = header.replace(/^Bearer /, '');
    const auth = token ? state.tokens.get(token) : null;
    state.calls.push({ method, path, body });
    const { status, body: out } = route(method, path, Object.fromEntries(url.searchParams), body, auth);
    return { ok: status >= 200 && status < 300, status, json: async () => structuredClone(out) };
  }

  return { state, fetch: fetchImpl, sign };
}

export function installFakeBackend() {
  const be = createBackend();
  vi.stubGlobal('fetch', vi.fn(be.fetch));
  return be;
}
