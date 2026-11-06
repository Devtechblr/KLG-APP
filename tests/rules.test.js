// Unit tests: backend -> app mapping and the website-matching delivery rules.
import { describe, expect, it, vi } from 'vitest';
import { buildDb, mapStatus, toOrder } from '../src/services/api/adapters';
import { NEXT_STEP, autoAcceptCountdown, canAssign, canCancel, driverHandoff, needsDriverFor, onRoad } from '../src/utils/status';
import { driverStep } from '../src/components/mobile/DriverDeliveryCard';
import { api, ApiError } from '../src/services/api/http';
import { notifyNewWork } from '../src/services/native/notifications';
import { installFakeBackend, makeOrder } from './fakeBackend';

describe('adapter: backend order -> app order', () => {
  it('maps fields, money and payment state', () => {
    const o = toOrder(makeOrder({ n: 1, orderStatus: 'PACKING', paymentMode: 'COD' }));
    expect(o).toMatchObject({
      id: 'KLG-T1', _id: 'oid1', status: 'PACKING', total: 229, subtotal: 180, packing: 10, deliveryCharge: 30, gst: 9,
      paymentMethod: 'COD', paymentStatus: 'UNPAID', riderAccepted: false, offer: false,
    });
    expect(o.items).toEqual([{ menuId: 'p1', name: 'Masala Dosa', qty: 2, price: 90 }]);
  });

  it('treats ICICI orders paid via isPaid / SUCCESS as paid online', () => {
    expect(toOrder(makeOrder({ paymentMode: 'ICICI', isPaid: true })).paymentStatus).toBe('PAID');
    expect(toOrder(makeOrder({ paymentMode: 'ICICI', paymentStatus: 'SUCCESS' }))).toMatchObject({ paymentMethod: 'ONLINE', paymentStatus: 'PAID' });
    expect(toOrder(makeOrder({ paymentStatus: 'REFUND_INITIATED' })).paymentStatus).toBe('REFUNDED');
  });

  it('maps statuses, including pickup COLLECTED and unknown values', () => {
    expect(mapStatus('COLLECTED')).toBe('DELIVERED');
    expect(mapStatus('out_for_delivery')).toBe('OUT_FOR_DELIVERY');
    expect(mapStatus('WEIRD')).toBe('PENDING');
  });

  it('marks AUTO offers for the driver and builds customers from delivery details', () => {
    const db = buildDb({ orders: [makeOrder({ n: 2, assignmentMode: 'AUTO', offeredRiderIds: ['r1', 'r2'] })], riders: [{ _id: 'r1', name: 'R', status: 'AVAILABLE' }], meId: 'r1' });
    expect(db.orders[0]).toMatchObject({ offer: true, driverId: 'r1', offeredCount: 2 });
    expect(db.customers[0]).toMatchObject({ name: 'Asha Rao', phone: '9876500001', address: '12 MG Road, Bengaluru', lat: 12.97 });
    expect(db.drivers[0]).toMatchObject({ id: 'r1', online: true, busy: false });
  });

  it('de-duplicates orders that come from several rider lists', () => {
    const o = makeOrder({ n: 3 });
    expect(buildDb({ orders: [o, { ...o }] }).orders).toHaveLength(1);
  });

  it('builds a timeline even when statusHistory is missing', () => {
    const o = toOrder(makeOrder({ statusHistory: undefined, orderStatus: 'DELIVERED', deliveredAt: new Date().toISOString() }));
    expect(o.timeline.map((t) => t.status)).toEqual(['PENDING', 'DELIVERED']);
  });
});

describe('restaurant flow: accept -> prepare -> parcel -> pick up -> delivered', () => {
  it('one clear button per stage', () => {
    expect(NEXT_STEP.PENDING).toEqual({ to: 'PREPARING', label: 'Accept Order' });
    expect(NEXT_STEP.ACCEPTED).toEqual({ to: 'PREPARING', label: 'Start Preparing' });
    expect(NEXT_STEP.PREPARING).toEqual({ to: 'PACKING', label: 'Parcel Ready' });
    expect(NEXT_STEP.PACKING).toEqual({ to: 'OUT_FOR_DELIVERY', label: 'Handed to Driver' });
    expect(NEXT_STEP.READY.to).toBe('OUT_FOR_DELIVERY');
    expect(NEXT_STEP.OUT_FOR_DELIVERY).toEqual({ to: 'DELIVERED', label: 'Mark Delivered' });
    expect(NEXT_STEP.DELIVERED).toBeUndefined();
  });

  it('a ready parcel with no driver asks for a driver first', () => {
    expect(needsDriverFor(toOrder(makeOrder({ orderStatus: 'PACKING' })), null)).toBe(true);
    expect(needsDriverFor(toOrder(makeOrder({ orderStatus: 'PACKING', riderId: 'r1' })), {})).toBe(false);
    expect(needsDriverFor(toOrder(makeOrder({ orderStatus: 'PREPARING' })), null)).toBe(false); // Parcel Ready comes first
  });

  it('assign only after accept; cancel until dispatched', () => {
    expect(canAssign('PENDING')).toBe(false);
    expect(canAssign('PREPARING')).toBe(true);
    expect(canAssign('OUT_FOR_DELIVERY')).toBe(false);
    expect(canCancel('PENDING')).toBe(true);
    expect(canCancel('OUT_FOR_DELIVERY')).toBe(false);
  });

  it('driver panel wording', () => {
    const base = toOrder(makeOrder({ orderStatus: 'PREPARING' }));
    expect(driverHandoff(base)).toBeNull();
    expect(driverHandoff({ ...base, assignmentMode: 'AUTO', offeredCount: 2 }).text).toMatch(/offered to 2 online drivers/);
    expect(driverHandoff({ ...base, driverId: 'r1' }).text).toBe('Waiting for driver to accept');
    expect(driverHandoff({ ...base, driverId: 'r1', riderAccepted: true }).text).toBe('Driver accepted · waiting for the parcel');
    expect(driverHandoff({ ...base, driverId: 'r1', riderAccepted: true, status: 'PACKING' }).text).toMatch(/coming to pick up/);
    expect(driverHandoff({ ...base, driverId: 'r1', status: 'OUT_FOR_DELIVERY' }).text).toBe('Picked up · on the way');
  });

  it('60 s auto-accept countdown for new orders', () => {
    const t0 = Date.parse('2026-11-04T10:00:00Z');
    const o = { status: 'PENDING', pendingAt: '2026-11-04T10:00:00Z' };
    expect(autoAcceptCountdown(o, t0 + 18_000)).toBe('0:42');
    expect(autoAcceptCountdown(o, t0 + 61_000)).toBe('any moment');
    expect(autoAcceptCountdown({ ...o, status: 'PREPARING' }, t0)).toBeNull();
  });
});

describe('driver steps', () => {
  const o = (over) => ({ ...toOrder(makeOrder({ orderStatus: 'READY', riderId: 'r1' })), ...over });
  it('accept -> wait for parcel -> picked up (start) -> delivered', () => {
    expect(driverStep(o({ status: 'PENDING' }))).toBeNull();
    expect(driverStep(o({ status: 'PREPARING' })).to).toBe('RIDER_ACCEPT');
    expect(driverStep(o({ status: 'PREPARING', riderAccepted: true }))).toBeNull(); // pick-up locked until parcel ready
    expect(driverStep(o({ status: 'PACKING', riderAccepted: true })).to).toBe('OUT_FOR_DELIVERY');
    expect(driverStep(o({})).to).toBe('RIDER_ACCEPT');
    expect(driverStep(o({ offer: true })).label).toMatch(/accept offer/);
    expect(driverStep(o({ riderAccepted: true })).to).toBe('OUT_FOR_DELIVERY');
    expect(driverStep(o({ status: 'OUT_FOR_DELIVERY', riderAccepted: true })).to).toBe('DELIVERED');
    expect(driverStep(o({ status: 'DELIVERED' }))).toBeNull();
  });
  it('onRoad counts accepted and out-for-delivery orders', () => {
    expect(onRoad(o({}))).toBe(false);
    expect(onRoad(o({ riderAccepted: true }))).toBe(true);
    expect(onRoad(o({ status: 'OUT_FOR_DELIVERY' }))).toBe(true);
  });
});

describe('http client', () => {
  it('sends the bearer token and surfaces backend error messages', async () => {
    const be = installFakeBackend();
    localStorage.setItem('klg.session', JSON.stringify({ token: be.sign('admin', 'a1', 'Delivery') }));
    const res = await api('/admin/riders');
    expect(res.data).toHaveLength(2);
    await expect(api('/admin/orders/nope/accept', { method: 'PATCH', body: {} })).rejects.toThrow('Order not found');
  });

  it('fires klg:unauthorized on 401', async () => {
    installFakeBackend();
    localStorage.setItem('klg.session', JSON.stringify({ token: 'revoked' }));
    const spy = vi.fn();
    window.addEventListener('klg:unauthorized', spy);
    await expect(api('/admin/riders')).rejects.toBeInstanceOf(ApiError);
    expect(spy).toHaveBeenCalledTimes(1);
    window.removeEventListener('klg:unauthorized', spy);
  });

  it('turns network failures into a readable message', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(api('/admin/riders', { auth: false })).rejects.toThrow(/No connection to the server/);
  });
});

describe('alerts (driver polling diff)', () => {
  it('alerts once for a new assignment and for a cancellation, not on first load', () => {
    const shown = [];
    vi.stubGlobal('Notification', Object.assign(function N(title, opts) { shown.push({ title, ...opts }); }, { permission: 'granted' }));
    const session = { role: 'driver', driverId: 'r1' };
    const empty = buildDb({ orders: [], meId: 'r1' });
    const assigned = buildDb({ orders: [makeOrder({ n: 7, orderStatus: 'PREPARING', riderId: 'r1' })], meId: 'r1' });
    notifyNewWork(null, assigned, session);
    expect(shown).toHaveLength(0);
    notifyNewWork(empty, assigned, session);
    notifyNewWork(assigned, assigned, session);
    expect(shown.map((s) => s.title)).toEqual(['New delivery assigned']);
    const acceptedCooking = buildDb({ orders: [makeOrder({ n: 7, orderStatus: 'PREPARING', riderId: 'r1', riderAcceptedAt: 'x' })], meId: 'r1' });
    const parcel = buildDb({ orders: [makeOrder({ n: 7, orderStatus: 'PACKING', riderId: 'r1', riderAcceptedAt: 'x' })], meId: 'r1' });
    notifyNewWork(acceptedCooking, parcel, session);
    expect(shown.at(-1).title).toBe('Parcel ready – pick up now');
    const cancelled = buildDb({ orders: [makeOrder({ n: 7, orderStatus: 'CANCELLED', riderId: 'r1' })], meId: 'r1' });
    notifyNewWork(assigned, cancelled, session);
    expect(shown.at(-1).title).toBe('Delivery cancelled');
  });

  it('alerts the admin (web) about new pending orders', () => {
    const shown = [];
    vi.stubGlobal('Notification', Object.assign(function N(title) { shown.push(title); }, { permission: 'granted' }));
    notifyNewWork(buildDb({}), buildDb({ orders: [makeOrder({ n: 8 })] }), { role: 'admin' });
    expect(shown).toEqual(['New Delivery Order']);
  });
});

describe('thermal receipt (ESC/POS)', () => {
  it('lays out a 58 mm delivery receipt with address, items and totals', async () => {
    const { receiptLines, receiptBytes, LAYOUTS } = await import('../src/utils/escpos');
    const db = buildDb({ orders: [makeOrder({ n: 9, deliveryDetails: { fullName: 'Asha Rao', phoneNumber: '9876500001', address: '12 MG Road', city: 'Bengaluru', specialInstructions: 'No onion' } })] });
    const order = db.orders[0];
    const lines = receiptLines(order, db.customers[0], { paperWidth: 58 }).map((l) => l.text);
    expect(lines.every((t) => t.length <= LAYOUTS[58].lineWidth)).toBe(true);
    expect(lines).toContain('Customer: Asha Rao');
    expect(lines.some((t) => t.startsWith('Address: 12 MG Road'))).toBe(true);
    expect(lines).toContain('Note: No onion');
    expect(lines.some((t) => /^2\s+Masala Dosa\s+90\.00\s+180\.00$/.test(t))).toBe(true);
    expect(lines.some((t) => /^GRAND TOTAL\s+229\.00$/.test(t))).toBe(true);
    expect(lines.some((t) => t.includes('COLLECT CASH'))).toBe(true);
    const bytes = receiptBytes(order, db.customers[0], { paperWidth: 80 });
    expect(bytes.slice(0, 2)).toEqual([0x1b, 0x40]); // init
    expect(bytes.slice(-3)).toEqual([0x1d, 0x56, 0x00]); // cut
  });

  it('knows which orders the server auto-accepted', () => {
    const o = buildDb({ orders: [makeOrder({ n: 10, orderStatus: 'PREPARING', statusHistory: [{ status: 'PENDING', updatedAt: '2026-11-05T10:00:00Z' }, { status: 'PREPARING', updatedAt: '2026-11-05T10:01:00Z', updatedBy: 'SYSTEM' }] })] }).orders[0];
    expect(o).toMatchObject({ autoAccepted: true, acceptedAt: '2026-11-05T10:01:00Z' });
  });
});
