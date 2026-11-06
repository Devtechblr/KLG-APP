import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RefreshCw, SlidersHorizontal, CalendarClock, ChevronDown, Truck } from 'lucide-react';
import PageHeader from '../components/mobile/PageHeader';
import SearchBar from '../components/mobile/SearchBar';
import FilterSheet from '../components/mobile/FilterSheet';
import DeliveryCard from '../components/mobile/DeliveryCard';
import AssignDriverSheet from '../components/mobile/AssignDriverSheet';
import LoadingSkeleton from '../components/mobile/LoadingSkeleton';
import EmptyState from '../components/mobile/EmptyState';
import Pagination from '../components/mobile/Pagination';
import { useData } from '../context/DataContext';
import { dayKey, fmtLongDate } from '../utils/format';
import { STATUS, STATUS_KEYS, ACTIVE_STATUSES, orderDriver } from '../utils/status';

const PAGE_SIZE = 15;
const OPTIONS = [{ value: 'ALL', label: 'All Status' }, { value: 'ACTIVE', label: 'Active only' }, ...STATUS_KEYS.map((k) => ({ value: k, label: STATUS[k].label }))];

export function matchOrder(o, q, customer, driver) {
  if (!q) return true;
  const hay = [o.id, customer?.name, customer?.phone, customer?.address, driver?.name, ...o.items.map((i) => i.name)].join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).every((t) => hay.includes(t));
}

export default function Deliveries() {
  const { db, loading, actions, customerById, driverById } = useData();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const status = params.get('status') || 'ALL';
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const [assignFor, setAssignFor] = useState(null);
  const [spinning, setSpinning] = useState(false);

  useEffect(() => setPage(1), [q, status]);

  const filtered = useMemo(() => {
    if (!db) return [];
    return db.orders.filter((o) =>
      (status === 'ALL' || (status === 'ACTIVE' ? ACTIVE_STATUSES.includes(o.status) : o.status === status)) &&
      matchOrder(o, q, customerById[o.customerId], driverById[o.driverId]));
  }, [db, q, status, customerById, driverById]);

  const counts = useMemo(() => {
    const c = { ALL: db?.orders.length ?? 0, ACTIVE: 0 };
    db?.orders.forEach((o) => { c[o.status] = (c[o.status] || 0) + 1; if (ACTIVE_STATUSES.includes(o.status)) c.ACTIVE += 1; });
    return c;
  }, [db]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const groups = useMemo(() => {
    const m = new Map();
    pageItems.forEach((o) => {
      const k = dayKey(o.createdAt);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(o);
    });
    return [...m.entries()];
  }, [pageItems]);

  const refresh = async () => {
    setSpinning(true);
    await actions.refresh();
    setSpinning(false);
  };
  const setStatus = (v) => { const p = new URLSearchParams(params); v === 'ALL' ? p.delete('status') : p.set('status', v); setParams(p, { replace: true }); };
  const assignOrder = assignFor ? db.orders.find((o) => o.id === assignFor) : null;
  const statusLabel = OPTIONS.find((o) => o.value === status)?.label;

  return (
    <div className="page">
      <PageHeader
        title="Delivery Orders"
        actions={
          <button className="btn btn-primary btn-sm" onClick={refresh} disabled={spinning} aria-label="Refresh deliveries">
            <RefreshCw size={16} className={spinning ? 'spin' : ''} /> <span className="hide-xs">Refresh</span>
          </button>
        }
      />

      <div className="sticky-tools">
        <SearchBar value={q} onChange={setQ} placeholder="Search order, customer, phone, item…">
          <button className={`filter-btn ${status !== 'ALL' ? 'is-active' : ''}`} onClick={() => setFilterOpen(true)} aria-label="Filter by status">
            <SlidersHorizontal size={18} />
            <span className="filter-text">{statusLabel}</span>
          </button>
        </SearchBar>
      </div>

      {loading ? (
        <LoadingSkeleton rows={3} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No delivery orders found"
          text={q ? `Nothing matches “${q}”.` : 'No orders with this status.'}
          action={<button className="btn btn-ghost" onClick={() => { setQ(''); setStatus('ALL'); }}>Clear filters</button>}
        />
      ) : (
        <>
          {groups.map(([day, orders]) => {
            const isCollapsed = collapsed[day] ?? false;
            return (
              <section key={day} className="day-group">
                <button className="day-head" onClick={() => setCollapsed((c) => ({ ...c, [day]: !isCollapsed }))} aria-expanded={!isCollapsed}>
                  <CalendarClock size={18} />
                  <span className="day-title">{fmtLongDate(orders[0].createdAt)}</span>
                  <span className="pill">{orders.length} Order{orders.length > 1 ? 's' : ''}</span>
                  <ChevronDown size={20} className={`chev ${isCollapsed ? '' : 'up'}`} />
                </button>
                <div className={`collapse ${isCollapsed ? '' : 'is-open'}`}>
                  <div className="card-grid">
                    {orders.map((o) => (
                      <DeliveryCard
                        key={o.id}
                        order={o}
                        customer={customerById[o.customerId]}
                        driver={orderDriver(o, driverById)}
                        onView={() => navigate(`/admin/delivery-orders/${o.id}`)}
                        onAssign={() => setAssignFor(o.id)}
                      />
                    ))}
                  </div>
                </div>
              </section>
            );
          })}
          <Pagination page={page} pages={pages} total={filtered.length} label="delivery orders" onPage={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
        </>
      )}

      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} options={OPTIONS} value={status} onChange={setStatus} counts={counts} />
      <AssignDriverSheet order={assignOrder} onClose={() => setAssignFor(null)} />
    </div>
  );
}
