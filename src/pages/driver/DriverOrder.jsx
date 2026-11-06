import { useEffect } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ArrowLeft, Check, MapPin, Navigation, Phone, Store, X, ChefHat } from 'lucide-react';
import SwipeButton from '../../components/mobile/SwipeButton';
import EmptyState from '../../components/mobile/EmptyState';
import { driverStep, driverWaitText, needsCash, shortId, useDriverAdvance, useDriverDecline, JobSteps, nextHint, LiveLocationPill } from '../../components/mobile/DriverDeliveryCard';
import { useData } from '../../context/DataContext';
import { stopRing } from '../../services/native/notifications';
import { fmtTime, inr, inr2, mapsHref, telHref } from '../../utils/format';

// Driver-facing timeline, simpler than the admin one.
const STEPS = [
  { key: 'placed', label: 'Order placed', statuses: ['PENDING'] },
  { key: 'prepared', label: 'Food prepared', statuses: ['READY', 'PACKING', 'ASSIGNED'] },
  { key: 'picked', label: 'Picked up', statuses: ['PICKED_UP'] },
  { key: 'transit', label: 'Out for delivery', statuses: ['OUT_FOR_DELIVERY'], sub: 'In transit' },
  { key: 'done', label: 'Delivered', statuses: ['DELIVERED'] },
];
const RANK = { PENDING: 0, ACCEPTED: 0, PREPARING: 0, PACKING: 1, READY: 1, ASSIGNED: 1, PICKED_UP: 2, OUT_FOR_DELIVERY: 3, DELIVERED: 4 };

export default function DriverOrder() {
  const { id } = useParams();
  const { me, sharing } = useOutletContext();
  const navigate = useNavigate();
  const { db, customerById, actions } = useData();
  const advance = useDriverAdvance();
  const decline = useDriverDecline();
  const order = db.orders.find((o) => o.id === id && o.driverId === me.id);
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/driver/active'));

  // Opening the order clears its unread backend notifications.
  const unread = (db.notifications || []).filter((n) => n.orderId === id && !n.read).map((n) => n._id);
  const unreadKey = unread.join(',');
  useEffect(() => { unread.forEach((nid) => actions.markNotificationRead?.(nid)); }, [unreadKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { stopRing(); }, [id]);

  if (!order) {
    return <EmptyState title="Order not found" text="It may have been reassigned to another driver."
      action={<button className="btn btn-primary" onClick={() => navigate('/driver/active')}>Back</button>} />;
  }

  const customer = customerById[order.customerId];
  const cancelled = order.status === 'CANCELLED';
  const rank = cancelled ? -1 : RANK[order.status];
  const at = (statuses) => order.timeline.find((t) => statuses.includes(t.status))?.at;
  const step = driverStep(order);
  const where = customer?.lat != null && customer?.lng != null ? `${customer.lat},${customer.lng}` : customer?.address || '';
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(where)}&z=15&output=embed`;

  return (
    <div className="page driver-order">
      <header className="order-bar">
        <button className="bar-btn" onClick={back} aria-label="Back"><ArrowLeft size={20} /></button>
        <h1>Details · {shortId(order.id)}</h1>
        <a className="bar-btn" href={telHref(customer?.phone)} aria-label="Call customer"><Phone size={18} /></a>
      </header>

      {!['DELIVERED', 'CANCELLED'].includes(order.status) && (
        <section className="card section">
          <JobSteps order={order} />
          <p className="job-next">{nextHint(order)}</p>
          {order.status === 'OUT_FOR_DELIVERY' && <LiveLocationPill sharing={sharing} />}
        </section>
      )}

      <section className="card map-card">
        <span className="map-chip"><Store size={13} /> Krishna Leela Grand</span>
        <iframe title="Delivery location map" src={mapSrc} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        <a className="map-go" href={mapsHref(where)} target="_blank" rel="noreferrer"><Navigation size={16} /> Navigate</a>
      </section>

      <section className="card section">
        <p className="jc-line"><span className="muted">Customer:</span> <b>{customer?.name}</b></p>
        <p className="jc-line jc-addr"><MapPin size={14} /> <span>{customer?.address}</span>{order.distanceKm ? <em>{order.distanceKm} km</em> : null}</p>
        {order.notes && <p className="note">{order.notes}</p>}
      </section>

      <section className="card section">
        <ol className="vtl">
          {STEPS.map((s, i) => {
            const state = cancelled ? 'todo' : i < rank || (i === rank && i === 4) ? 'done' : i === rank ? 'now' : 'todo';
            const time = at(s.statuses);
            return (
              <li key={s.key} className={state}>
                <span className="vtl-dot">{state === 'done' ? <Check size={12} /> : null}</span>
                <span className="vtl-text">
                  <b>{s.label}</b>
                  {state === 'now' && s.sub ? <small className="now">{s.sub}</small> : time && state !== 'todo' ? <small>{fmtTime(time)}</small> : null}
                </span>
              </li>
            );
          })}
          {cancelled && (
            <li className="cancel"><span className="vtl-dot"><X size={12} /></span><span className="vtl-text"><b>Cancelled</b></span></li>
          )}
        </ol>
      </section>

      <section className="card section">
        <ul className="bill">
          {order.items.map((i) => (
            <li key={i.menuId}><span>{i.name}<em> x {i.qty}</em></span><b>{inr2(i.qty * i.price)}</b></li>
          ))}
        </ul>
      </section>

      <section className={`card cash-card ${needsCash(order) ? '' : 'paid'}`}>
        <span className="cash-label">{needsCash(order) ? 'Cash to collect' : order.paymentMethod === 'ONLINE' ? 'Paid online' : 'Cash collected'}</span>
        <strong>{inr(order.total, 2)}</strong>
        {step ? (
          <SwipeButton label={step.label} onConfirm={() => advance(order)} tone={step.to === 'DELIVERED' ? 'green' : 'orange'} />
        ) : !['DELIVERED', 'CANCELLED', 'OUT_FOR_DELIVERY'].includes(order.status) ? (
          <div className="driver-wait"><ChefHat size={16} /> {driverWaitText(order)}</div>
        ) : null}
        {order.offer && <button className="btn btn-ghost btn-block" onClick={() => decline(order)}>Decline offer</button>}
      </section>
    </div>
  );
}
