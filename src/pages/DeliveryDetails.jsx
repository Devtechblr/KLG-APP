import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Phone, MapPin, Navigation, Printer, Bike, UserPlus, Repeat, Receipt, User, CreditCard, History,
  Check, X, ListChecks, StickyNote, MessageCircle,
} from 'lucide-react';
import StatusBadge from '../components/mobile/StatusBadge';
import AssignDriverSheet from '../components/mobile/AssignDriverSheet';
import FilterSheet from '../components/mobile/FilterSheet';
import LoadingSkeleton from '../components/mobile/LoadingSkeleton';
import EmptyState from '../components/mobile/EmptyState';
import useOrderActions from '../components/mobile/useOrderActions';
import { useData } from '../context/DataContext';
import { fmtDateTime, fmtTime, inr2, mapsHref, telHref, initials } from '../utils/format';
import { STATUS, STATUS_KEYS, NEXT_STEP, FLOW, FLOW_LABEL, flowIndex, canAssign, canCancel, needsDriverFor, orderDriver, driverHandoff, autoAcceptCountdown } from '../utils/status';
import { USE_MOCK_DATA } from '../config';

export default function DeliveryDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { db, loading, customerById, driverById } = useData();
  const act = useOrderActions();
  const [assignOpen, setAssignOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  if (loading || !db) return <LoadingSkeleton rows={3} />;
  const order = db.orders.find((o) => o.id === id);
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/admin/delivery-orders'));
  if (!order) {
    return <EmptyState title="Order not found" text={`No order with ID ${id}.`} action={<button className="btn btn-primary" onClick={() => navigate('/admin/delivery-orders')}>Back to deliveries</button>} />;
  }

  const customer = customerById[order.customerId];
  const driver = orderDriver(order, driverById);
  const next = NEXT_STEP[order.status];
  const needsDriver = needsDriverFor(order, driver);
  const handoff = driverHandoff(order);
  const cancelled = order.status === 'CANCELLED';
  const reachedIdx = cancelled
    ? Math.max(...order.timeline.map((t) => flowIndex(t.status)), 0)
    : flowIndex(order.status);
  const whenReached = (s) => order.timeline.find((t) => flowIndex(t.status) === flowIndex(s))?.at;
  const custOrders = db.orders.filter((o) => o.customerId === order.customerId).length;

  return (
    <div className="page details">
      <div className="details-top">
        <button className="icon-btn" onClick={back} aria-label="Back"><ArrowLeft size={20} /></button>
        <div className="grow">
          <h1 className="details-id">{order.id}</h1>
          <span className="muted small">{fmtDateTime(order.createdAt)}</span>
        </div>
        <button className="icon-btn" onClick={() => act.print(order)} aria-label="Print receipt"><Printer size={18} /></button>
      </div>

      <div className="card status-hero">
        <div className="sh-row">
          <StatusBadge status={order.status} />
          {USE_MOCK_DATA && <button className="link" onClick={() => setStatusOpen(true)}>Change status</button>}
          {autoAcceptCountdown(order) && <small className="tone-text-warning">Auto-accepts {autoAcceptCountdown(order) === 'any moment' ? 'any moment' : `in ${autoAcceptCountdown(order)}`}</small>}
        </div>
        <ol className={`stepper ${cancelled ? 'is-cancelled' : ''}`}>
          {FLOW.map((s, i) => {
            const done = i <= reachedIdx;
            const at = whenReached(s);
            return (
              <li key={s} className={`${done ? 'done' : ''} ${i === reachedIdx && !cancelled ? 'current' : ''}`}>
                <span className="step-dot">{done ? <Check size={12} /> : null}</span>
                <span className="step-text">
                  <b>{FLOW_LABEL[s] || STATUS[s].label}</b>
                  {at && <small>{fmtTime(at)}</small>}
                </span>
              </li>
            );
          })}
          {cancelled && (
            <li className="done cancelled current">
              <span className="step-dot"><X size={12} /></span>
              <span className="step-text"><b>Cancelled</b><small>{fmtTime(whenReached('CANCELLED') || order.createdAt)}</small></span>
            </li>
          )}
        </ol>
      </div>

      <section className="card section">
        <h2 className="sec-title"><User size={16} /> Customer</h2>
        <div className="person-row">
          <span className="avatar">{initials(customer?.name)}</span>
          <span className="grow">
            <strong>{customer?.name}</strong>
            <small className="muted">{customer?.phone} · {custOrders} order{custOrders > 1 ? 's' : ''}</small>
          </span>
          <a className="round-btn green" href={telHref(customer?.phone)} aria-label="Call customer"><Phone size={18} /></a>
          <a className="round-btn wa" href={`https://wa.me/91${customer?.phone}`} target="_blank" rel="noreferrer" aria-label="WhatsApp customer"><MessageCircle size={18} /></a>
        </div>
        <h2 className="sec-title mt"><MapPin size={16} /> Delivery Address</h2>
        <p className="address-text">{customer?.address}</p>
        <div className="row-2">
          <a className="btn btn-ghost" href={mapsHref(customer?.address)} target="_blank" rel="noreferrer"><Navigation size={16} /> Open in Maps</a>
          {order.distanceKm ? <span className="pill-muted">≈ {order.distanceKm} km</span> : null}
        </div>
        {order.notes && <p className="note"><StickyNote size={14} /> {order.notes}</p>}
      </section>

      <section className="card section">
        <h2 className="sec-title"><Receipt size={16} /> Food Items ({order.items.reduce((s, i) => s + i.qty, 0)})</h2>
        <ul className="bill">
          {order.items.map((i) => (
            <li key={i.menuId}><span>{i.name}<em> x {i.qty}</em><small>{inr2(i.price)} each</small></span><b>{inr2(i.qty * i.price)}</b></li>
          ))}
          <li className="muted"><span>Item total</span><b>{inr2(order.subtotal)}</b></li>
          {order.packing > 0 && <li className="muted"><span>Packing charges</span><b>{inr2(order.packing)}</b></li>}
          {order.deliveryCharge > 0 && <li className="muted"><span>Delivery charge</span><b>{inr2(order.deliveryCharge)}</b></li>}
          {order.gst > 0 && <li className="muted"><span>GST</span><b>{inr2(order.gst)}</b></li>}
          <li className="bill-total"><span>Total Amount</span><b>{inr2(order.total)}</b></li>
        </ul>
      </section>

      <section className="card section">
        <h2 className="sec-title"><CreditCard size={16} /> Payment</h2>
        <div className="kv"><span>Method</span><b>{order.paymentMethod === 'ONLINE' ? 'Online (UPI / Card)' : 'Cash on Delivery'}</b></div>
        <div className="kv"><span>Status</span><StatusBadge payment={order.paymentStatus} /></div>
        <div className="kv"><span>Amount</span><b>{inr2(order.total)}</b></div>
      </section>

      <section className="card section">
        <h2 className="sec-title"><Bike size={16} /> Driver</h2>
        {driver ? (
          <div className="person-row">
            <span className="avatar">{initials(driver.name)}<i className={`presence ${driver.online ? 'on' : ''}`} /></span>
            <span className="grow">
              <strong>{driver.name}</strong>
              <small className={handoff ? `tone-text-${handoff.tone}` : 'muted'}>{handoff?.text || (driver.vehicleNo ? `${driver.vehicle} · ${driver.vehicleNo}` : driver.phone)}</small>
            </span>
            <a className="round-btn green" href={telHref(driver.phone)} aria-label="Call driver"><Phone size={18} /></a>
          </div>
        ) : (
          <p className="muted">{cancelled ? 'No driver – order cancelled.' : order.status === 'PENDING' ? 'Accept the order to assign a driver.' : handoff?.text || 'No driver assigned yet.'}</p>
        )}
        {order.tracking && order.status === 'OUT_FOR_DELIVERY' && (
          <a className="btn btn-ghost btn-block mt" href={mapsHref(`${order.tracking.latitude},${order.tracking.longitude}`)} target="_blank" rel="noreferrer">
            <Navigation size={16} /> Driver location · {fmtTime(order.tracking.updatedAt)}
          </a>
        )}
        {canAssign(order.status) && (
          <button className={`btn ${driver ? 'btn-ghost' : 'btn-soft'} btn-block mt`} onClick={() => setAssignOpen(true)}>
            {driver ? <><Repeat size={16} /> Reassign driver</> : <><UserPlus size={16} /> Assign driver</>}
          </button>
        )}
      </section>

      <section className="card section">
        <h2 className="sec-title"><History size={16} /> Order History</h2>
        <ul className="history">
          {[...order.timeline].reverse().map((t, i) => (
            <li key={i}>
              <span className={`h-dot tone-bg-${STATUS[t.status]?.tone}`} />
              <span className="grow"><b>{STATUS[t.status]?.label || t.status}</b>{t.note && <small>{t.note}</small>}</span>
              <small className="muted">{fmtDateTime(t.at)}</small>
            </li>
          ))}
        </ul>
      </section>

      {(next || needsDriver || canCancel(order.status)) && (
        <div className="action-bar">
          {canCancel(order.status) && (
            <button className="btn btn-danger-soft" onClick={() => act.cancel(order)}>Cancel</button>
          )}
          {needsDriver ? (
            <button className="btn btn-primary grow" onClick={() => setAssignOpen(true)}><Bike size={18} /> {USE_MOCK_DATA ? 'Dispatch – assign driver' : 'Assign Driver'}</button>
          ) : next ? (
            <button className="btn btn-primary grow" onClick={() => act.advance(order)}><ListChecks size={18} /> {next.label}</button>
          ) : null}
        </div>
      )}

      <AssignDriverSheet order={assignOpen ? order : null} onClose={() => setAssignOpen(false)} />
      <FilterSheet
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        title="Change order status"
        options={STATUS_KEYS.map((k) => ({ value: k, label: STATUS[k].label }))}
        value={order.status}
        onChange={(s) => act.setStatus(order, s)}
      />
    </div>
  );
}
