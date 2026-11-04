import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Bike, RefreshCw } from 'lucide-react';
import EmptyState from '../../components/mobile/EmptyState';
import DriverDeliveryCard from '../../components/mobile/DriverDeliveryCard';
import { useData } from '../../context/DataContext';
import { DRIVER_ACTIVE } from '../../components/layout/DriverLayout';
import { greeting, inr, initials, startOfDay } from '../../utils/format';

// On the road first, then ready to pick up, then still in the kitchen.
const ORDER = ['OUT_FOR_DELIVERY', 'PICKED_UP', 'ASSIGNED', 'READY', 'PACKING', 'PREPARING', 'ACCEPTED', 'PENDING'];

export default function DriverActive() {
  const { me } = useOutletContext();
  const { db, actions, customerById } = useData();

  const mine = useMemo(
    () => db.orders
      .filter((o) => o.driverId === me.id && DRIVER_ACTIVE.includes(o.status))
      // Accepted work first, then new assignments, then open offers.
      .sort((a, b) => Number(!!a.offer) - Number(!!b.offer) || Number(b.riderAccepted ?? 0) - Number(a.riderAccepted ?? 0) ||
        ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || new Date(a.createdAt) - new Date(b.createdAt)),
    [db, me.id]
  );

  const today = useMemo(() => {
    const from = startOfDay().getTime();
    const done = db.orders.filter((o) => o.driverId === me.id && o.status === 'DELIVERED' &&
      new Date(o.timeline.find((t) => t.status === 'DELIVERED')?.at || o.createdAt).getTime() >= from);
    return {
      count: done.length,
      km: done.reduce((s, o) => s + (o.distanceKm || 0), 0),
      cash: done.filter((o) => o.paymentMethod === 'COD' && o.paymentStatus !== 'PAID').reduce((s, o) => s + o.total, 0),
      value: done.reduce((s, o) => s + o.total, 0),
    };
  }, [db, me.id]);

  return (
    <div className="page driver-home">
      <section className="hero">
        <div className="hero-top">
          <span className="hero-avatar">{initials(me.name)}</span>
          <label className={`hero-toggle ${me.online ? 'on' : ''}`}>
            <input type="checkbox" checked={!!me.online} disabled={me.busy} onChange={() => actions.toggleDriverOnline(me.id)} />
            <span>{me.online ? 'Online' : 'Offline'}</span>
            <i />
          </label>
        </div>
        <p className="hero-greet">{greeting()},</p>
        <h1 className="hero-name">Hello, {me.name.split(' ')[0]}!</h1>
      </section>

      <section className="card today-card">
        <div className="today-main">
          <span className="muted">Today's deliveries</span>
          <strong>{inr(today.value)}</strong>
        </div>
        <div className="today-row">
          <span>Completed: <b>{db.stats ? db.stats.todaysRides : today.count}</b></span>
          <span>Distance: <b>{Number(db.stats ? db.stats.todaysKm : today.km).toFixed(1)} km</b></span>
          <span>Cash: <b>{inr(today.cash)}</b></span>
        </div>
      </section>

      <div className="row-head">
        <h2>My Deliveries {mine.length > 0 && <em>{mine.length}</em>}</h2>
        <button className="icon-btn sm" onClick={actions.refresh} aria-label="Refresh"><RefreshCw size={16} /></button>
      </div>

      {!me.online && <div className="card driver-offline">You are offline. Turn on <b>Online</b> above to get new orders.</div>}

      {mine.length === 0 ? (
        <EmptyState icon={Bike} title="No deliveries right now" text="Orders assigned or offered to you appear here. Keep the app open to get alerts." />
      ) : (
        <div className="card-grid">
          {mine.map((o) => <DriverDeliveryCard key={o.id} order={o} customer={customerById[o.customerId]} />)}
        </div>
      )}
    </div>
  );
}
