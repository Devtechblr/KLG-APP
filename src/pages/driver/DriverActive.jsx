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
      <section className={`hero ${me.online ? 'is-on' : 'is-off'}`}>
        <div className="hero-who">
          <span className="hero-avatar">{initials(me.name)}</span>
          <span>
            <p className="hero-greet">{greeting()}</p>
            <h1 className="hero-name">Hello, {me.name.split(' ')[0]}!</h1>
          </span>
        </div>
        <label className={`hero-status ${me.online ? 'on' : ''}`}>
          <input type="checkbox" checked={!!me.online} disabled={me.busy} onChange={() => actions.toggleDriverOnline(me.id)} aria-label="Online" />
          <span className="hero-status-text">
            <b>{me.online ? "You're Online" : "You're Offline"}</b>
            <small>{me.busy ? 'On a delivery · finish it to go offline' : me.online ? 'New orders will ring on this phone' : 'Turn on to start getting orders'}</small>
          </span>
          <i />
        </label>
      </section>

      <section className="today-tiles">
        <div><span>Delivered today</span><strong>{db.stats ? db.stats.todaysRides : today.count}</strong></div>
        <div><span>Distance</span><strong>{Number(db.stats ? db.stats.todaysKm : today.km).toFixed(1)}<small> km</small></strong></div>
        <div><span>Cash in hand</span><strong>{inr(today.cash)}</strong></div>
      </section>

      <div className="row-head">
        <h2>My Deliveries {mine.length > 0 && <em>{mine.length}</em>}</h2>
        <button className="icon-btn sm" onClick={actions.refresh} aria-label="Refresh"><RefreshCw size={16} /></button>
      </div>

      {mine.length === 0 ? (
        <EmptyState icon={Bike} title={me.online ? 'Waiting for orders' : 'You are offline'} text={me.online ? 'When the restaurant sends you a delivery, your phone rings and it shows up here.' : 'Turn on Online above to start getting deliveries.'} />
      ) : (
        <div className="card-grid">
          {mine.map((o) => <DriverDeliveryCard key={o.id} order={o} customer={customerById[o.customerId]} />)}
        </div>
      )}
    </div>
  );
}
