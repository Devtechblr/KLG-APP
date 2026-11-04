import { useEffect, useState } from 'react';
import { Clock, MapPin, Phone, Printer, User, Bike, ChevronDown, Navigation, UserPlus, Repeat, Eye, IndianRupee } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { fmtTime, inr, inr2, mapsHref, telHref } from '../../utils/format';
import { NEXT_STEP, canAssign, canCancel, needsDriverFor, driverHandoff, autoAcceptCountdown } from '../../utils/status';
import useOrderActions from './useOrderActions';

export default function DeliveryCard({ order, customer, driver, onView, onAssign }) {
  const [showItems, setShowItems] = useState(false);
  const act = useOrderActions();
  const next = NEXT_STEP[order.status];
  const itemCount = order.items.reduce((s, i) => s + i.qty, 0);
  const needsDriver = needsDriverFor(order, driver);
  const handoff = driverHandoff(order);
  const [now, setNow] = useState(Date.now());
  const countdown = autoAcceptCountdown(order, now);
  useEffect(() => {
    if (order.status !== 'PENDING') return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [order.status]);

  return (
    <article className={`card dcard status-${order.status.toLowerCase()}`}>
      <header className="dc-head">
        <div>
          <h3 className="dc-id">{order.id}</h3>
          <span className="muted small"><Clock size={13} /> {fmtTime(order.createdAt)}</span>
        </div>
        <div className="dc-head-right">
          <StatusBadge status={order.status} />
          <button className="icon-btn sm" onClick={() => act.print(order)} aria-label="Print receipt"><Printer size={16} /></button>
        </div>
      </header>

      {countdown && (
        <p className="dc-incoming" role="status">
          <span className="dc-incoming-dot" /> New order – accept or cancel · auto-accepts {countdown === 'any moment' ? 'any moment' : `in ${countdown}`}
        </p>
      )}

      <section className="dc-customer">
        <div className="dc-person">
          <span className="dc-label">Deliver to</span>
          <strong><User size={14} /> {customer?.name}</strong>
          <a className="dc-phone" href={telHref(customer?.phone)}><Phone size={13} /> {customer?.phone}</a>
        </div>
        <div className="dc-quick">
          <a className="round-btn green" href={telHref(customer?.phone)} aria-label={`Call ${customer?.name}`}><Phone size={18} /></a>
          <a className="round-btn blue" href={mapsHref(customer?.address)} target="_blank" rel="noreferrer" aria-label="Open address in Google Maps"><Navigation size={18} /></a>
        </div>
      </section>

      <a className="dc-address" href={mapsHref(customer?.address)} target="_blank" rel="noreferrer">
        <MapPin size={15} /> <span>{customer?.address}</span>
      </a>

      <button className="dc-items-toggle" onClick={() => setShowItems((v) => !v)} aria-expanded={showItems}>
        <span><b>{itemCount}</b> item{itemCount > 1 ? 's' : ''} · {order.items.map((i) => i.name).slice(0, 2).join(', ')}{order.items.length > 2 ? '…' : ''}</span>
        <ChevronDown size={18} className={`chev ${showItems ? 'up' : ''}`} />
      </button>
      <div className={`collapse ${showItems ? 'is-open' : ''}`}>
        <ul className="dc-items">
          {order.items.map((i) => (
            <li key={i.menuId}><span>{i.name} <em>x {i.qty}</em></span><span>{inr2(i.qty * i.price)}</span></li>
          ))}
          {order.packing > 0 && <li className="muted"><span>Packing</span><span>{inr2(order.packing)}</span></li>}
          {order.deliveryCharge > 0 && <li className="muted"><span>Delivery</span><span>{inr2(order.deliveryCharge)}</span></li>}
        </ul>
      </div>

      <div className="dc-total">
        <span className="dc-pay"><IndianRupee size={14} /> {order.paymentMethod === 'ONLINE' ? 'Online' : 'Cash on Delivery'} <StatusBadge payment={order.paymentStatus} dot={false} /></span>
        <strong>{inr(order.total, 2)}</strong>
      </div>

      <div className={`dc-driver ${driver ? '' : 'empty'} ${needsDriver ? 'attn' : ''}`}>
        <Bike size={16} />
        {driver ? (
          <>
            <span className="grow"><strong>{driver.name}</strong><small className={handoff ? `tone-text-${handoff.tone}` : ''}>{handoff?.text || driver.vehicleNo}</small></span>
            <a className="icon-btn sm" href={telHref(driver.phone)} aria-label={`Call driver ${driver.name}`}><Phone size={15} /></a>
            {canAssign(order.status) && (
              <button className="btn btn-ghost btn-sm" onClick={onAssign}><Repeat size={14} /> Reassign</button>
            )}
          </>
        ) : (
          <>
            <span className={`grow ${handoff ? `tone-text-${handoff.tone}` : ''}`}>{order.status === 'CANCELLED' ? 'No driver' : order.status === 'PENDING' ? 'Accept the order to assign a driver' : handoff?.text || 'No driver assigned'}</span>
            {canAssign(order.status) && (
              <button className="btn btn-soft btn-sm" onClick={onAssign}><UserPlus size={14} /> Assign</button>
            )}
          </>
        )}
      </div>

      <footer className="dc-actions">
        <button className="btn btn-ghost" onClick={onView}><Eye size={16} /> Details</button>
        {needsDriver ? (
          <button className="btn btn-primary" onClick={onAssign}><Bike size={16} /> Assign Driver</button>
        ) : next ? (
          <button className="btn btn-primary" onClick={() => act.advance(order)}>{next.label}</button>
        ) : null}
        {canCancel(order.status) && !next && !needsDriver && (
          <button className="btn btn-danger-soft" onClick={() => act.cancel(order)}>Cancel</button>
        )}
      </footer>
      {canCancel(order.status) && (next || needsDriver) && (
        <button className="link-danger" onClick={() => act.cancel(order)}>Cancel order</button>
      )}
    </article>
  );
}
