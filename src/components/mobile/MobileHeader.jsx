import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronRight } from 'lucide-react';
import BrandMark from './BrandMark';
import BottomSheet from './BottomSheet';
import StatusBadge from './StatusBadge';
import EmptyState from './EmptyState';
import OrderModeSwitches from './OrderModeSwitches';
import StaffControls from './StaffControls';
import useOrderModes from '../../hooks/useOrderModes';
import { useData } from '../../context/DataContext';
import { fmtTime, inr } from '../../utils/format';

export default function MobileHeader() {
  const { db, customerById } = useData();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const showModes = !!useOrderModes().modes;

  // The top bar is taller with the Delivery / Pickup row: move the page down.
  useEffect(() => {
    document.documentElement.classList.toggle('with-modes', showModes);
    return () => document.documentElement.classList.remove('with-modes');
  }, [showModes]);

  const alerts = useMemo(
    () => (db ? db.orders.filter((o) => o.status === 'PENDING' || o.status === 'READY') : []),
    [db]
  );

  return (
    <>
      <header className={`m-header ${showModes ? 'has-modes' : ''}`}>
        <div className="m-header-row">
          <button className="m-brand" onClick={() => navigate('/admin/delivery-orders')} aria-label="Go to deliveries">
            <BrandMark size={38} />
            <span className="m-brand-text">
              <strong>Krishna Leela Grand</strong>
              <small>Pure Vegetarian Restaurant</small>
            </span>
          </button>
          <span className="m-header-actions">
            <StaffControls />
            <button className="icon-btn bell" onClick={() => setOpen(true)} aria-label={`Notifications (${alerts.length})`}>
              <Bell size={20} />
              {alerts.length > 0 && <span className="bell-count">{alerts.length}</span>}
            </button>
          </span>
        </div>
        <OrderModeSwitches compact />
      </header>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Notifications">
        {alerts.length === 0 ? (
          <EmptyState icon={Bell} title="All caught up" text="New and ready orders will show up here." />
        ) : (
          <ul className="notif-list">
            {alerts.map((o) => (
              <li key={o.id}>
                <button
                  className="notif"
                  onClick={() => { setOpen(false); navigate(`/admin/delivery-orders/${o.id}`); }}
                >
                  <span className={`notif-dot ${o.status === 'READY' ? 'ready' : ''}`} />
                  <span className="notif-body">
                    <strong>{o.status === 'PENDING' ? 'New order received' : 'Order ready for pickup'}</strong>
                    <small>{o.id} · {customerById[o.customerId]?.name} · {inr(o.total)}</small>
                  </span>
                  <span className="notif-meta">
                    <StatusBadge status={o.status} dot={false} />
                    <small>{fmtTime(o.createdAt)}</small>
                  </span>
                  <ChevronRight size={16} className="muted" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </BottomSheet>
    </>
  );
}
