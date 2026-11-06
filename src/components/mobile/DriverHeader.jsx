import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronRight } from 'lucide-react';
import BrandMark from './BrandMark';
import BottomSheet from './BottomSheet';
import EmptyState from './EmptyState';
import { useData } from '../../context/DataContext';
import { fmtTime, inr } from '../../utils/format';
import { awaitingDriver } from './DriverOfferAlert';
import { shortId } from './DriverDeliveryCard';

// What the driver has to do next for each of their orders, in plain words.
export function driverTodo(o, meId) {
  if (o.driverId !== meId) return null;
  if (awaitingDriver(o, meId)) return { tone: 'new', title: o.offer ? 'New delivery request' : 'Delivery assigned to you', text: 'Tap to accept' };
  if (o.riderAccepted && ['PACKING', 'READY'].includes(o.status)) return { tone: 'ready', title: 'Parcel ready · pick up now', text: 'Go to the restaurant counter' };
  if (o.status === 'OUT_FOR_DELIVERY') return { tone: 'road', title: 'Deliver to customer', text: 'Swipe when delivered' };
  return null;
}

export default function DriverHeader({ me }) {
  const { db, customerById, actions } = useData();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const todo = useMemo(() => (db ? db.orders
    .map((o) => ({ o, t: driverTodo(o, me.id) }))
    .filter((x) => x.t) : []), [db, me.id]);
  const recent = useMemo(() => (db?.notifications || []).slice(0, 15), [db]);
  const unread = recent.filter((n) => !n.read).length;
  const count = Math.max(todo.length, unread);

  const go = (orderId, n) => {
    setOpen(false);
    if (n && !n.read) actions.markNotificationRead?.(n._id);
    if (orderId && db.orders.some((o) => o.id === orderId)) navigate(`/driver/order/${orderId}`);
  };

  return (
    <>
      <header className="m-header drv-header">
        <span className="m-brand">
          <BrandMark size={38} />
          <span className="m-brand-text">
            <strong>Krishna Leela Grand</strong>
            <small>Delivery partner · {me.name.split(' ')[0]}</small>
          </span>
        </span>
        <button className="icon-btn bell" onClick={() => setOpen(true)} aria-label={`Notifications (${count})`}>
          <Bell size={20} />
          {count > 0 && <span className="bell-count">{count}</span>}
        </button>
      </header>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Notifications">
        {todo.length === 0 && recent.length === 0 ? (
          <EmptyState icon={Bell} title="All caught up" text="New deliveries and pick-up alerts will show up here." />
        ) : (
          <>
            {todo.length > 0 && <p className="ad-label">Needs your action</p>}
            <ul className="notif-list">
              {todo.map(({ o, t }) => (
                <li key={o.id}>
                  <button className="notif" onClick={() => go(o.id)}>
                    <span className={`notif-dot drv-${t.tone}`} />
                    <span className="notif-body">
                      <strong>{t.title}</strong>
                      <small>Order {shortId(o.id)} · {customerById[o.customerId]?.name} · {inr(o.total)}</small>
                    </span>
                    <ChevronRight size={16} className="muted" />
                  </button>
                </li>
              ))}
            </ul>
            {recent.length > 0 && <p className="ad-label">Recent</p>}
            <ul className="notif-list">
              {recent.map((n) => (
                <li key={n._id}>
                  <button className={`notif ${n.read ? 'is-read' : ''}`} onClick={() => go(n.orderId, n)}>
                    <span className={`notif-dot ${n.read ? 'drv-read' : 'drv-new'}`} />
                    <span className="notif-body">
                      <strong>{n.title || 'Delivery update'}</strong>
                      <small>{n.orderId ? `Order ${shortId(n.orderId)}` : ''}{n.message ? ` · ${n.message}` : ''}</small>
                    </span>
                    {n.createdAt && <span className="notif-meta"><small>{fmtTime(n.createdAt)}</small></span>}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </BottomSheet>
    </>
  );
}
