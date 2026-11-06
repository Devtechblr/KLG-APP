import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, MapPin, Package, IndianRupee, ChevronDown } from 'lucide-react';
import BrandMark from './BrandMark';
import { useData, useUi } from '../../context/DataContext';
import { inr } from '../../utils/format';
import { stopRing } from '../../services/native/notifications';
import { shortId, needsCash } from './DriverDeliveryCard';

// Restaurant has the order and this driver has not answered yet.
const WAITING = ['ACCEPTED', 'PREPARING', 'PACKING', 'READY'];
export const awaitingDriver = (o, meId) =>
  o.driverId === meId && 'riderAccepted' in o && !o.riderAccepted && WAITING.includes(o.status);

/**
 * Driver side "incoming call" screen: shown over the whole app while a delivery
 * offered/assigned to this driver waits for an answer. The phone rings
 * (notifications.js) until the driver accepts, declines or minimises it.
 */
export default function DriverOfferAlert({ meId }) {
  const { db, actions, customerById } = useData();
  const { confirm } = useUi();
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(() => new Set());
  const [busy, setBusy] = useState(false);

  const waiting = db ? db.orders.filter((o) => awaitingDriver(o, meId) && !hidden.has(o.id)) : [];
  const order = waiting[0];
  if (!order) return null;

  const customer = customerById?.[order.customerId];
  const items = order.items.reduce((s, i) => s + i.qty, 0);
  const area = (customer?.address || '').split(',').slice(0, 2).join(',').trim();
  const hide = () => { stopRing(); setHidden((s) => new Set(s).add(order.id)); };

  const accept = async () => {
    setBusy(true);
    stopRing();
    const ok = await actions.setStatus(order.id, 'RIDER_ACCEPT', 'Accepted by driver');
    setBusy(false);
    if (ok !== false) navigate(`/driver/order/${order.id}`);
  };
  const decline = async () => {
    const ok = await confirm({ title: 'Decline this delivery?', message: `Order ${order.id} will go to another driver.`, confirmLabel: 'Decline', danger: true });
    if (!ok) return;
    setBusy(true);
    stopRing();
    await actions.setStatus(order.id, 'RIDER_REJECT');
    setBusy(false);
  };

  return (
    <div className="incoming" role="alertdialog" aria-modal="true" aria-labelledby="incoming-title">
      <button className="incoming-min" onClick={hide} aria-label="Minimise"><ChevronDown size={22} /></button>

      <div className="incoming-top">
        <span className="incoming-ring"><BrandMark size={84} /></span>
        <p className="incoming-kicker">{order.offer ? 'New delivery request' : 'Delivery assigned to you'}</p>
        <h1 id="incoming-title">Order {shortId(order.id)}</h1>
        <p className="incoming-sub">
          {['PACKING', 'READY'].includes(order.status) ? 'Parcel is ready · pick up now' : 'Food is being prepared'}
          {waiting.length > 1 && ` · ${waiting.length} waiting`}
        </p>
      </div>

      <div className="incoming-card">
        {area && <p><MapPin size={16} /> <span>{area}</span>{order.distanceKm ? <em>{order.distanceKm} km</em> : null}</p>}
        <p><Package size={16} /> <span>{items} item{items > 1 ? 's' : ''}</span></p>
        <p>
          <IndianRupee size={16} /> <b>{inr(order.total)}</b>
          <span className={`incoming-pay ${needsCash(order) ? 'cash' : ''}`}>{needsCash(order) ? 'Collect cash' : 'Paid online'}</span>
        </p>
      </div>

      <div className="incoming-actions">
        {order.offer ? (
          <button className="incoming-btn decline" onClick={decline} disabled={busy}>
            <span><X size={30} /></span>Decline
          </button>
        ) : (
          <button className="incoming-btn later" onClick={hide} disabled={busy}>
            <span><ChevronDown size={30} /></span>Later
          </button>
        )}
        <button className="incoming-btn accept" onClick={accept} disabled={busy}>
          <span><Check size={32} /></span>Accept
        </button>
      </div>
    </div>
  );
}
