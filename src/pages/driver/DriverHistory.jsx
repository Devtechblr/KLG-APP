import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { History } from 'lucide-react';
import PageHeader from '../../components/mobile/PageHeader';
import EmptyState from '../../components/mobile/EmptyState';
import DriverDeliveryCard from '../../components/mobile/DriverDeliveryCard';
import { useData } from '../../context/DataContext';
import { DAY_MS, inr, startOfDay } from '../../utils/format';

const RANGES = [
  { key: 'today', label: 'Today', days: 1 },
  { key: 'week', label: '7 days', days: 7 },
  { key: 'all', label: 'All', days: Infinity },
];

const doneAt = (o) => new Date([...o.timeline].reverse().find((t) => t.status === o.status)?.at || o.createdAt);

export default function DriverHistory() {
  const { me } = useOutletContext();
  const { db, customerById } = useData();
  const [range, setRange] = useState('today');

  const list = useMemo(() => {
    const days = RANGES.find((r) => r.key === range).days;
    const from = days === Infinity ? 0 : startOfDay().getTime() - (days - 1) * DAY_MS;
    return db.orders
      .filter((o) => o.driverId === me.id && (o.status === 'DELIVERED' || o.status === 'CANCELLED') && doneAt(o).getTime() >= from)
      .sort((a, b) => doneAt(b) - doneAt(a));
  }, [db, me.id, range]);

  const delivered = list.filter((o) => o.status === 'DELIVERED');
  const km = delivered.reduce((s, o) => s + (o.distanceKm || 0), 0);
  const cash = delivered.filter((o) => o.paymentMethod === 'COD' && o.paymentStatus !== 'PAID').reduce((s, o) => s + o.total, 0);

  return (
    <div className="page">
      <PageHeader title="History" subtitle="Your completed deliveries" />
      <div className="segmented">
        {RANGES.map((r) => (
          <button key={r.key} className={range === r.key ? 'is-active' : ''} onClick={() => setRange(r.key)}>{r.label}</button>
        ))}
      </div>
      <div className="driver-stats card">
        <div><strong>{delivered.length}</strong><small>Delivered</small></div>
        <div><strong>{km.toFixed(1)} km</strong><small>Distance</small></div>
        <div><strong>{inr(cash)}</strong><small>Cash collected</small></div>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={History} title="No deliveries in this period" />
      ) : (
        <div className="card-grid">
          {list.map((o) => <DriverDeliveryCard key={o.id} order={o} customer={customerById[o.customerId]} done />)}
        </div>
      )}
    </div>
  );
}
