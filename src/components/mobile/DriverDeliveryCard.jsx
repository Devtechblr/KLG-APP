import { useNavigate } from 'react-router-dom';
import { MapPin, Phone, Navigation, ChefHat, Clock, ChevronRight } from 'lucide-react';
import StatusBadge from './StatusBadge';
import SwipeButton from './SwipeButton';
import { fmtDateTime, fmtTime, inr, mapsHref, telHref } from '../../utils/format';
import { useData, useUi } from '../../context/DataContext';

// The steps a driver moves an order through once the restaurant hands it over.
export const DRIVER_STEP = {
  ASSIGNED: { to: 'PICKED_UP', label: 'Swipe when picked up' },
  PICKED_UP: { to: 'OUT_FOR_DELIVERY', label: 'Swipe to start delivery' },
  OUT_FOR_DELIVERY: { to: 'DELIVERED', label: 'Swipe to mark delivered' },
};
export const KITCHEN = ['PENDING', 'ACCEPTED', 'PREPARING'];
const PRE_DISPATCH = ['PENDING', 'ACCEPTED', 'PREPARING', 'PACKING', 'READY'];

// Real API: accept the offer/assignment -> start delivery (picked up) -> complete.
// RIDER_ACCEPT is an app-only step that calls POST /rider/orders/:id/accept.
export function driverStep(order) {
  if (!('riderAccepted' in order)) return DRIVER_STEP[order.status] || null; // demo data
  if (order.status === 'OUT_FOR_DELIVERY') return DRIVER_STEP.OUT_FOR_DELIVERY;
  if (!PRE_DISPATCH.includes(order.status)) return null;
  if (order.status === 'PENDING') return null; // restaurant hasn't accepted yet
  if (!order.riderAccepted) return { to: 'RIDER_ACCEPT', label: order.offer ? 'Swipe to accept offer' : 'Swipe to accept delivery' };
  // Pick-up unlocks only once the restaurant marks the parcel ready.
  if (['PACKING', 'READY'].includes(order.status)) return { to: 'OUT_FOR_DELIVERY', label: 'Swipe when picked up' };
  return null;
}
export const shortId = (id) => '#' + id.split('-').pop();
export const needsCash = (o) => o.paymentMethod === 'COD' && o.paymentStatus !== 'PAID';

// Shared by the card and the order screen.
export function useDriverAdvance() {
  const { actions, customerById } = useData();
  const { confirm } = useUi();
  return async (order) => {
    const step = driverStep(order);
    if (!step) return;

    if (step.to === 'DELIVERED' && needsCash(order)) {
      const ok = await confirm({
        title: `Collected ${inr(order.total, 2)}?`,
        message: `Confirm you received the cash from ${customerById[order.customerId]?.name}.`,
        confirmLabel: 'Cash received',
      });
      if (!ok) return;
    }
    actions.setStatus(order.id, step.to, 'Updated by driver');
  };
}

export function useDriverDecline() {
  const { actions } = useData();
  const { confirm } = useUi();
  return async (order) => {
    const ok = await confirm({ title: 'Decline this offer?', message: `Order ${order.id} will be offered to other drivers.`, confirmLabel: 'Decline', danger: true });
    if (ok) actions.setStatus(order.id, 'RIDER_REJECT');
  };
}

export const driverWaitText = (order) => (KITCHEN.includes(order.status)
  ? 'Food is being prepared · pick-up unlocks when the parcel is ready'
  : 'Ready, waiting for hand-over');

export default function DriverDeliveryCard({ order, customer, done = false }) {
  const navigate = useNavigate();
  const advance = useDriverAdvance();
  const decline = useDriverDecline();
  const step = driverStep(order);
  const finishedAt = done ? [...order.timeline].reverse().find((t) => t.status === order.status)?.at : null;
  const open = () => navigate(`/driver/order/${order.id}`);

  return (
    <article className={`card jcard ${done ? 'is-done' : ''}`}>
      <button className="jc-head" onClick={open} aria-label={`Open order ${order.id}`}>
        <span>
          <strong className="jc-id">Order {shortId(order.id)}</strong>
          <small className="muted"><Clock size={12} /> {done && finishedAt ? fmtDateTime(finishedAt) : fmtTime(order.createdAt)}</small>
        </span>
        {order.offer ? <StatusBadge tone="orange" label="Offer" dot={false} /> : <StatusBadge status={order.status} dot={false} />}
        <ChevronRight size={18} className="muted" />
      </button>

      <div className="jc-body">
        <p className="jc-line"><span className="muted">Customer:</span> <b>{customer?.name}</b></p>
        <p className="jc-line jc-addr"><MapPin size={14} /> <span>{customer?.address}</span>{order.distanceKm ? <em>{order.distanceKm} km</em> : null}</p>
        <p className="jc-line">
          <span className="muted">{order.items.reduce((s, i) => s + i.qty, 0)} items</span>
          <span className="dot-sep" />
          <b>{inr(order.total)}</b>
          <span className={`jc-pay ${needsCash(order) && !done ? 'cash' : ''}`}>
            {order.paymentMethod === 'ONLINE' ? 'Paid online' : needsCash(order) ? 'Collect cash' : 'Cash collected'}
          </span>
        </p>
      </div>

      {!done && (
        <>
          <div className="jc-quick">
            <a className="qa" href={telHref(customer?.phone)}><span className="qa-ic green"><Phone size={20} /></span>Call</a>
            <a className="qa" href={mapsHref(customer?.address)} target="_blank" rel="noreferrer"><span className="qa-ic purple"><Navigation size={20} /></span>Navigate</a>
          </div>
          {step ? (
            <SwipeButton label={step.label} onConfirm={() => advance(order)} tone={step.to === 'DELIVERED' ? 'green' : 'orange'} />
          ) : (
            <div className="driver-wait">
              <ChefHat size={16} />
              {driverWaitText(order)}
            </div>
          )}
          {order.offer && <button className="btn btn-ghost btn-block" onClick={() => decline(order)}>Decline offer</button>}
        </>
      )}
    </article>
  );
}
