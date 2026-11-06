import { useEffect, useState } from 'react';
import { Check, X, MapPin, Phone, Clock } from 'lucide-react';
import BottomSheet from './BottomSheet';
import { useData, useUi } from '../../context/DataContext';
import { autoAcceptCountdown } from '../../utils/status';
import { fmtTime, inr, inr2 } from '../../utils/format';
import { stopRing } from '../../services/native/notifications';
import { USE_MOCK_DATA } from '../../config';

/**
 * Pops up over every admin screen while a delivery order waits for an answer:
 * big Accept / Reject buttons and the 60 s auto-accept countdown.
 */
export default function NewOrderAlert() {
  const { db, actions, customerById } = useData();
  const { confirm } = useUi();
  const [hidden, setHidden] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const waiting = USE_MOCK_DATA || !db ? [] : db.orders
    .filter((o) => o.status === 'PENDING' && !hidden.has(o.id))
    .sort((a, b) => new Date(a.pendingAt || a.createdAt) - new Date(b.pendingAt || b.createdAt));
  const order = waiting[0] || null;

  useEffect(() => {
    if (!order) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [order?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!order) return null;
  const customer = customerById?.[order.customerId];
  const countdown = autoAcceptCountdown(order, now);
  const hide = () => { stopRing(); setHidden((s) => new Set(s).add(order.id)); };

  const accept = async () => {
    setBusy(true);
    stopRing();
    await actions.setStatus(order.id, 'PREPARING');
    setBusy(false);
  };
  const reject = async () => {
    const ok = await confirm({
      title: 'Reject this order?',
      message: `${order.id} will be cancelled.${order.paymentStatus === 'PAID' ? ' The online payment will be marked as refunded.' : ''}`,
      confirmLabel: 'Reject Order',
      cancelLabel: 'Keep Order',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    stopRing();
    await actions.setStatus(order.id, 'CANCELLED', 'Rejected by restaurant');
    setBusy(false);
  };

  return (
    <BottomSheet
      open
      onClose={hide}
      title={waiting.length > 1 ? `New delivery order (1 of ${waiting.length})` : 'New delivery order'}
      footer={(
        <div className="noa-actions">
          <button className="btn btn-danger-soft noa-btn" onClick={reject} disabled={busy}><X size={20} /> Reject</button>
          <button className="btn btn-primary noa-btn" onClick={accept} disabled={busy}><Check size={20} /> Accept</button>
        </div>
      )}
    >
      <div className="noa">
        <div className="noa-head">
          <strong className="noa-id">{order.id}</strong>
          <span className="muted small"><Clock size={13} /> {fmtTime(order.pendingAt || order.createdAt)}</span>
        </div>
        {countdown && (
          <p className="noa-count" role="status">
            Auto-accepts {countdown === 'any moment' ? 'any moment' : <>in <b>{countdown}</b></>}
          </p>
        )}
        <p className="noa-line"><b>{customer?.name}</b>{customer?.phone && <span className="muted"> · <Phone size={12} /> {customer.phone}</span>}</p>
        <p className="noa-line muted"><MapPin size={13} /> {customer?.address}</p>
        <ul className="noa-items">
          {order.items.map((i) => (
            <li key={i.menuId}><span>{i.name} <em>x {i.qty}</em></span><span>{inr2(i.qty * i.price)}</span></li>
          ))}
        </ul>
        {order.notes && <p className="noa-note">Note: {order.notes}</p>}
        <div className="noa-total">
          <span>{order.paymentMethod === 'ONLINE' ? 'Paid online' : 'Cash on Delivery'}</span>
          <strong>{inr(order.total, 2)}</strong>
        </div>
      </div>
    </BottomSheet>
  );
}
