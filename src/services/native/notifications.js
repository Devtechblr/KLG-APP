// Alerts for the delivery app.
//
// Admin phones: the backend already sends an FCM push (type NEW_ORDER / ORDER_RESOLVED)
//   to every device registered at POST /public/device-tokens. enableAdminPush() registers
//   this phone; the native KlgMessagingService rings and shows the alert even when the app
//   is closed.
// Driver phones: the backend has no per-driver push, so while the app is open (or recently
//   backgrounded) we compare each poll with the previous one and raise a local alert for
//   new assignments / offers / cancellations.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { API_BASE_URL } from '../../config';

const KlgNative = registerPlugin('KlgNative');
const native = () => Capacitor.isNativePlatform();
let adminPushOn = false;

export async function enableAdminPush() {
  if (!native()) return { enabled: false, reason: 'web' };
  try {
    const res = await KlgNative.enablePush({ endpoint: `${API_BASE_URL}/public/device-tokens` });
    adminPushOn = !!res?.enabled;
    return res;
  } catch (e) {
    adminPushOn = false;
    return { enabled: false, reason: e.message };
  }
}

export async function disablePush() {
  adminPushOn = false;
  if (!native()) return;
  try { await KlgNative.disablePush(); } catch { /* ignore */ }
}

export async function pushStatus() {
  if (!native()) return { enabled: false, reason: 'web' };
  try { return await KlgNative.pushStatus(); } catch (e) { return { enabled: false, reason: e.message }; }
}

export async function stopRing() {
  if (native()) { try { await KlgNative.stopRing(); } catch { /* ignore */ } }
}

export async function alertUser({ title, body, ring = true, key }) {
  if (native()) {
    try { await KlgNative.notify({ title, body, ring, key }); } catch { /* ignore */ }
    return;
  }
  try {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') await Notification.requestPermission();
    if (Notification.permission === 'granted') new Notification(title, { body });
  } catch { /* ignore */ }
}

const ACTIVE = ['PENDING', 'ACCEPTED', 'PREPARING', 'PACKING', 'READY', 'OUT_FOR_DELIVERY'];

// Compare two polls and alert on what is new. `prev` null = first load (no alerts).
export function notifyNewWork(prev, next, session) {
  if (!prev || !next || !session) return;
  const before = new Map(prev.orders.map((o) => [o.id, o]));

  if (session.role === 'driver') {
    const me = session.driverId;
    next.orders.forEach((o) => {
      if (o.driverId !== me) return;
      const old = before.get(o.id);
      const waiting = ACTIVE.includes(o.status) && o.status !== 'OUT_FOR_DELIVERY' && !o.riderAccepted;
      const wasWaiting = old && old.driverId === me && !old.riderAccepted && ACTIVE.includes(old.status);
      if (waiting && !wasWaiting) {
        alertUser({
          title: o.offer ? 'New delivery offer' : 'New delivery assigned',
          body: `Order ${o.id} · ₹${Math.round(o.total)}${o.paymentMethod === 'COD' ? ' · collect cash' : ''}`,
        });
      }
      const parcelReady = (x) => x && x.riderAccepted && ['PACKING', 'READY'].includes(x.status);
      if (parcelReady(o) && old && !parcelReady(old)) {
        alertUser({ title: 'Parcel ready – pick up now', body: `Order ${o.id} is packed and waiting for you.` });
      }
      if (old && old.status !== 'CANCELLED' && o.status === 'CANCELLED') {
        alertUser({ title: 'Delivery cancelled', body: `Order ${o.id} was cancelled by the restaurant.`, ring: false });
      }
    });
    return;
  }

  // Admin: ring as soon as the poll sees a new order. The FCM push may also
  // arrive (or arrive late); the native side rings only once per order id.
  next.orders
    .filter((o) => o.status === 'PENDING' && (!before.has(o.id) || before.get(o.id).status !== 'PENDING'))
    .forEach((o) => alertUser({
      key: o.id,
      title: 'New Delivery Order',
      body: `Order ${o.id} · ₹${Math.round(o.total)} · open to accept or reject`,
    }));
}
