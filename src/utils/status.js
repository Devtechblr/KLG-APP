import { USE_MOCK_DATA } from '../config';

// Order statuses. PENDING..DELIVERED/CANCELLED mirror the backend's orderStatus.
// ASSIGNED and PICKED_UP exist only in demo mode; with the real API the driver
// hand-off is tracked by order.driverId + order.riderAccepted instead.
export const STATUS = {
  PENDING: { label: 'Pending', tone: 'warning' },
  ACCEPTED: { label: 'Accepted', tone: 'info' },
  PREPARING: { label: 'Preparing', tone: 'info' },
  PACKING: { label: USE_MOCK_DATA ? 'Packing' : 'Parcel Ready', tone: 'violet' },
  READY: { label: 'Ready', tone: 'violet' },
  ASSIGNED: { label: 'Assigned', tone: 'orange' },
  PICKED_UP: { label: 'Picked Up', tone: 'orange' },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', tone: 'orange' },
  DELIVERED: { label: 'Delivered', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
};
const DEMO_ONLY = ['ASSIGNED', 'PICKED_UP'];
const API_ONLY = ['PACKING'];
export const STATUS_KEYS = Object.keys(STATUS).filter((k) => !(USE_MOCK_DATA ? API_ONLY : DEMO_ONLY).includes(k));
export const ACTIVE_STATUSES = ['PENDING', 'ACCEPTED', 'PREPARING', 'PACKING', 'READY', 'ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY'];

// Next step for the admin's primary action button on an order.
export const NEXT_STEP = USE_MOCK_DATA
  ? {
      PENDING: { to: 'ACCEPTED', label: 'Accept Order' },
      ACCEPTED: { to: 'PREPARING', label: 'Start Preparing' },
      PREPARING: { to: 'READY', label: 'Mark Ready' },
      ASSIGNED: { to: 'PICKED_UP', label: 'Mark Picked Up' },
      PICKED_UP: { to: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
      OUT_FOR_DELIVERY: { to: 'DELIVERED', label: 'Mark Delivered' },
    }
  : {
      // Restaurant flow: accept -> prepare -> parcel ready -> driver picks up -> delivered.
      // All transitions are allowed by the backend (orderStatusService.js, DELIVERY).
      PENDING: { to: 'PREPARING', label: 'Accept Order' },
      ACCEPTED: { to: 'PREPARING', label: 'Start Preparing' },
      PREPARING: { to: 'PACKING', label: 'Parcel Ready' },
      PACKING: { to: 'OUT_FOR_DELIVERY', label: 'Handed to Driver' },
      READY: { to: 'OUT_FOR_DELIVERY', label: 'Handed to Driver' },
      // Backup for when the driver's phone can't (driver normally marks it).
      OUT_FOR_DELIVERY: { to: 'DELIVERED', label: 'Mark Delivered' },
    };
// Website hides driver assignment until the kitchen has accepted the order.
export const canAssign = (s) => (USE_MOCK_DATA
  ? ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'ASSIGNED']
  : ['ACCEPTED', 'PREPARING', 'PACKING', 'READY']).includes(s);
export const canCancel = (s) => ['PENDING', 'ACCEPTED', 'PREPARING', 'PACKING', 'READY', 'ASSIGNED'].includes(s);

// Driver is physically handling this order.
export const onRoad = (o) =>
  ['ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY'].includes(o.status) ||
  (!!o.riderAccepted && ACTIVE_STATUSES.includes(o.status));

// Stepper shown on the admin order screen.
export const FLOW = USE_MOCK_DATA
  ? ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED']
  : ['PENDING', 'PREPARING', 'PACKING', 'OUT_FOR_DELIVERY', 'DELIVERED'];
const FLOW_ALIAS = USE_MOCK_DATA ? { PACKING: 'READY' } : { ACCEPTED: 'PENDING', READY: 'PACKING' };
export const flowIndex = (s) => FLOW.indexOf(FLOW_ALIAS[s] || s);
// Stepper labels in live mode (the order's journey, in plain words).
export const FLOW_LABEL = USE_MOCK_DATA ? {} : {
  PENDING: 'Order received', PREPARING: 'Preparing', PACKING: 'Parcel ready', OUT_FOR_DELIVERY: 'Picked up · on the way', DELIVERED: 'Delivered',
};

// Parcel is ready but no driver has it: the primary button opens the driver picker.
export const needsDriverFor = (order, driver) => (USE_MOCK_DATA
  ? order.status === 'READY' && !driver
  : ['PACKING', 'READY'].includes(order.status) && !order.driverId);

// Driver for an order; falls back to the name/phone stored on the order.
export function orderDriver(order, driverById) {
  if (!order.driverId) return null;
  return driverById?.[order.driverId] || (order.riderName
    ? { id: order.driverId, name: order.riderName, phone: order.riderPhone || '', vehicle: 'Vehicle', vehicleNo: '', online: true }
    : null);
}

// Where the driver hand-off stands, worded like the website's driver panel (real API only).
// Returns { tone, text } or null.
export function driverHandoff(order) {
  if (USE_MOCK_DATA || ['PENDING', 'CANCELLED'].includes(order.status)) return null;
  if (order.status === 'DELIVERED') return order.driverId ? { tone: 'neutral', text: 'Delivered' } : null;
  if (!order.driverId) {
    return order.assignmentMode === 'AUTO' && order.offeredCount > 0
      ? { tone: 'warning', text: `Waiting for driver to accept · offered to ${order.offeredCount} online driver${order.offeredCount > 1 ? 's' : ''}` }
      : null;
  }
  if (order.status === 'OUT_FOR_DELIVERY') return { tone: 'info', text: 'Picked up · on the way' };
  if (!order.riderAccepted) return { tone: 'warning', text: 'Waiting for driver to accept' };
  return ['PACKING', 'READY'].includes(order.status)
    ? { tone: 'success', text: 'Driver accepted · coming to pick up the parcel' }
    : { tone: 'success', text: 'Driver accepted · waiting for the parcel' };
}

// 60 s auto-accept window for new orders (backend jobs/autoAcceptDeliveryOrders.js).
export const AUTO_ACCEPT_AFTER_MS = 60 * 1000;
export function autoAcceptCountdown(order, now = Date.now()) {
  if (USE_MOCK_DATA || order.status !== 'PENDING') return null;
  const start = new Date(order.pendingAt || order.createdAt).getTime();
  if (!Number.isFinite(start)) return null;
  const left = start + AUTO_ACCEPT_AFTER_MS - now;
  if (left <= 0) return 'any moment';
  const s = Math.ceil(left / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const PAYMENT = {
  PAID: { label: 'Paid', tone: 'success' },
  UNPAID: { label: 'Unpaid', tone: 'warning' },
  REFUNDED: { label: 'Refunded', tone: 'neutral' },
};
