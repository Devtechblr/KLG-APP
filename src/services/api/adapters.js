// Converts KLG backend (MongoDB) documents into the shape the app's screens use.
// Backend order: { _id, orderId, orderStatus, riderId, riderAcceptedAt, deliveryDetails, items[{name, price, quantity}], ... }
// App order:     { id, _id, status, driverId, customerId, items[{name, price, qty}], total, timeline[], ... }

const STATUS_MAP = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  PREPARING: 'PREPARING',
  PACKING: 'PACKING',
  READY: 'READY',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  COLLECTED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
};
export const mapStatus = (s) => STATUS_MAP[String(s || '').toUpperCase()] || 'PENDING';

const idOf = (v) => (v && typeof v === 'object' ? String(v._id || v.id || '') : v ? String(v) : null) || null;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function paymentStatus(o) {
  const ps = String(o.paymentStatus || '').toUpperCase();
  if (ps === 'REFUNDED' || ps === 'REFUND_INITIATED') return 'REFUNDED';
  if (o.isPaid || ps === 'PAID' || ps === 'SUCCESS' || ['COMPLETED', 'CAPTURED'].includes(String(o.payment?.status || '').toUpperCase())) return 'PAID';
  return 'UNPAID';
}

function timeline(o) {
  const t = (o.statusHistory || []).map((h) => ({
    status: mapStatus(h.status),
    at: h.updatedAt || o.updatedAt,
    note: String(h.updatedBy || '').startsWith('RIDER_') ? 'Updated by driver' : '',
  }));
  if (!t.some((x) => x.status === 'PENDING')) t.unshift({ status: 'PENDING', at: o.createdAt, note: '' });
  const ensure = (status, at) => { if (at && !t.some((x) => x.status === status)) t.push({ status, at, note: '' }); };
  ensure('OUT_FOR_DELIVERY', o.outForDeliveryAt);
  ensure('DELIVERED', o.deliveredAt);
  return t.filter((x) => x.at).sort((a, b) => new Date(a.at) - new Date(b.at));
}

export function toCustomer(o) {
  const d = o.deliveryDetails || {};
  const user = typeof o.userId === 'object' ? o.userId : null;
  const address = [d.address, d.city, d.postalCode].filter(Boolean).join(', ');
  return {
    id: `c-${o.orderId}`,
    name: d.fullName || o.customerName || user?.name || 'Customer',
    phone: d.phoneNumber || user?.phone || o.payment?.contact || '',
    address: address || 'Address not provided',
    area: d.city || '',
    lat: d.latitude ?? null,
    lng: d.longitude ?? null,
  };
}

// Who moved the order out of PENDING, and when ('SYSTEM' = the backend's 60 s auto-accept).
function acceptance(o) {
  const h = (o.statusHistory || []).find((x) => ['ACCEPTED', 'PREPARING'].includes(String(x.status || '').toUpperCase()));
  return { acceptedAt: h?.updatedAt || o.preparingAt || null, acceptedBy: h?.updatedBy || null };
}

export function toOrder(o, { meId } = {}) {
  const riderId = idOf(o.riderId);
  const { acceptedAt, acceptedBy } = acceptance(o);
  const isOffer = !!meId && !riderId && o.assignmentMode === 'AUTO';
  return {
    id: o.orderId,
    _id: idOf(o._id),
    createdAt: o.createdAt,
    customerId: `c-${o.orderId}`,
    items: (o.items || []).map((i, k) => ({
      menuId: idOf(i.productId) || `${k}`,
      name: i.name,
      qty: num(i.quantity || i.qty || 1),
      price: num(i.price),
    })),
    subtotal: num(o.subtotal),
    packing: num(o.parcelCharge),
    deliveryCharge: num(o.deliveryCharge),
    gst: num(o.gstAmount),
    total: num(o.totalAmount),
    paymentMethod: String(o.paymentMode || '').toUpperCase() === 'COD' ? 'COD' : 'ONLINE',
    paymentStatus: paymentStatus(o),
    status: mapStatus(o.orderStatus),
    driverId: isOffer ? meId : riderId,
    riderName: o.riderName || null,
    riderPhone: o.riderPhone || null,
    riderAccepted: !!o.riderAcceptedAt,
    assignmentMode: o.assignmentMode || 'MANUAL',
    offer: isOffer,
    offeredCount: (o.offeredRiderIds || []).length,
    pendingAt: o.pendingAt || null,
    acceptedAt,
    autoAccepted: acceptedBy === 'SYSTEM',
    distanceKm: o.deliveryDistanceKm != null ? num(o.deliveryDistanceKm) : null,
    notes: o.deliveryDetails?.specialInstructions || o.notes || '',
    tokenNumber: o.tokenNumber || null,
    tracking: o.deliveryTracking?.latitude != null ? o.deliveryTracking : null,
    timeline: timeline(o),
  };
}

export function toDriver(r) {
  return {
    id: idOf(r._id || r.id),
    name: r.name || 'Driver',
    phone: String(r.phone || '').replace(/\D/g, '').slice(-10),
    email: r.email || '',
    vehicle: 'Vehicle',
    vehicleNo: r.vehicleNumber || '',
    online: r.status !== 'OFFLINE',
    busy: r.status === 'BUSY',
    riderStatus: r.status || 'OFFLINE',
    joinedAt: r.createdAt || null,
    rating: null,
  };
}

// Build the app's db object from backend orders + riders.
export function buildDb({ orders = [], riders = [], meId, adminUser, notifications = [] }) {
  const seen = new Map();
  orders.forEach((o) => { if (o?.orderId) seen.set(o.orderId, o); });
  const raw = [...seen.values()];
  return {
    orders: raw.map((o) => toOrder(o, { meId })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    customers: raw.map(toCustomer),
    drivers: riders.map(toDriver),
    menu: [],
    adminUsers: adminUser ? [adminUser] : [],
    notifications,
  };
}
