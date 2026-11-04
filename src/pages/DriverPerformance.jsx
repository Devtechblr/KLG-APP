import { useMemo, useState } from 'react';
import { PackageCheck, Route, Trophy, Milestone, Phone, BarChart3, Search } from 'lucide-react';
import PageHeader from '../components/mobile/PageHeader';
import StatCard from '../components/mobile/StatCard';
import DateFilter from '../components/mobile/DateFilter';
import StatusBadge from '../components/mobile/StatusBadge';
import BottomSheet from '../components/mobile/BottomSheet';
import SearchBar from '../components/mobile/SearchBar';
import LoadingSkeleton from '../components/mobile/LoadingSkeleton';
import EmptyState from '../components/mobile/EmptyState';
import BarChart from '../components/charts/BarChart';
import { useData } from '../context/DataContext';
import { dayKey, initials, rangeFor, telHref } from '../utils/format';
import { computeDriverStats, driverState, km, lastNDays, totals } from '../utils/driverStats';

const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'Lifetime' },
  { key: 'custom', label: 'Custom' },
];
const PERIODS = [['today', 'Today'], ['week', 'This Week'], ['month', 'This Month'], ['lifetime', 'Lifetime']];

export default function DriverPerformance() {
  const { db, loading } = useData();
  const [preset, setPreset] = useState('7d');
  const [custom, setCustom] = useState({});
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('range');
  const [detail, setDetail] = useState(null);

  const data = useMemo(() => {
    if (!db) return null;
    const range = rangeFor(preset, custom);
    const per = computeDriverStats(db, range);
    const days = lastNDays(14);
    const teamDaily = days.map((d) => ({
      label: String(d.getDate()),
      sub: d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' }),
      value: Object.values(per).reduce((a, p) => a + (p.daily[dayKey(d)] || 0), 0),
    }));
    return { per, today: totals(per, 'today'), lifetime: totals(per, 'lifetime'), rangeTotal: totals(per, 'range'), teamDaily, days };
  }, [db, preset, custom]);

  if (loading || !data) return <LoadingSkeleton stats={4} rows={2} />;

  const list = db.drivers
    .filter((d) => d.name.toLowerCase().includes(q.toLowerCase()) || d.phone.includes(q))
    .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : data.per[b.id][sort].rides - data.per[a.id][sort].rides));
  const best = Math.max(1, ...db.drivers.map((d) => data.per[d.id].range.rides));
  const rangeLabel = PRESETS.find((p) => p.key === preset)?.label;
  const dd = detail && db.drivers.find((d) => d.id === detail);

  return (
    <div className="page">
      <PageHeader title="Driver Performance" subtitle="Deliveries and distance covered per driver — today, this week, this month and lifetime" />

      <div className="stat-grid">
        <StatCard icon={PackageCheck} label="Today's Deliveries" value={data.today.rides} tone="orange" />
        <StatCard icon={Route} label="Today's Distance" value={km(data.today.km)} tone="blue" />
        <StatCard icon={Trophy} label="Lifetime Deliveries" value={data.lifetime.rides.toLocaleString('en-IN')} tone="green" />
        <StatCard icon={Milestone} label="Lifetime Distance" value={km(data.lifetime.km)} tone="violet" />
      </div>

      <section className="card section">
        <div className="section-head"><h2><BarChart3 size={18} /> Daily deliveries · last 14 days</h2></div>
        <BarChart data={data.teamDaily} format={(v) => `${v} deliveries`} title="Team deliveries per day" />
      </section>

      <div className="section-head"><h2>Per-Driver Breakdown</h2></div>
      <DateFilter value={preset} onChange={setPreset} custom={custom} onCustom={setCustom} presets={PRESETS} />
      <div className="range-summary">
        <span><b>{data.rangeTotal.rides}</b> deliveries</span>
        <span><b>{km(data.rangeTotal.km)}</b> covered</span>
        <span className="muted">{rangeLabel}</span>
      </div>

      <SearchBar value={q} onChange={setQ} placeholder="Search drivers">
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort drivers">
          <option value="range">Top: selected range</option>
          <option value="today">Top: today</option>
          <option value="lifetime">Top: lifetime</option>
          <option value="name">Name A–Z</option>
        </select>
      </SearchBar>

      {list.length === 0 ? (
        <EmptyState icon={Search} title="No drivers match" text="Try a different name or phone number." />
      ) : (
        <div className="card-grid">
          {list.map((d, idx) => {
            const p = data.per[d.id];
            const st = driverState(d, p.active);
            return (
              <article key={d.id} className="card perf-card">
                <button className="perf-head" onClick={() => setDetail(d.id)}>
                  <span className="avatar">{initials(d.name)}<i className={`presence ${d.online ? 'on' : ''}`} /></span>
                  <span className="grow">
                    <strong>{d.name}</strong>
                    <small className="muted">{d.phone}</small>
                  </span>
                  <StatusBadge tone={st.tone} label={st.label} />
                </button>
                <div className="perf-range">
                  <div className="perf-range-top">
                    <span className="muted small">{rangeLabel}</span>
                    {sort !== 'name' && idx === 0 && p.range.rides > 0 && <span className="tag gold"><Trophy size={11} /> Top</span>}
                  </div>
                  <div className="perf-range-nums">
                    <span><b>{p.range.rides}</b> rides</span>
                    <span><b>{km(p.range.km)}</b></span>
                  </div>
                  <span className="perf-bar"><i style={{ width: `${(p.range.rides / best) * 100}%` }} /></span>
                </div>
                <div className="perf-periods">
                  {PERIODS.map(([k, label]) => (
                    <div key={k}>
                      <small>{label}</small>
                      <b>{p[k].rides} <em>rides</em></b>
                      <span>{km(p[k].km)}</span>
                    </div>
                  ))}
                </div>
                <div className="perf-actions">
                  <a className="btn btn-ghost btn-sm" href={telHref(d.phone)}><Phone size={14} /> Call</a>
                  <button className="btn btn-soft btn-sm" onClick={() => setDetail(d.id)}><BarChart3 size={14} /> Daily stats</button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <BottomSheet open={!!dd} onClose={() => setDetail(null)} title={dd ? dd.name : ''} tall>
        {dd && (() => {
          const p = data.per[dd.id];
          const chart = data.days.map((d) => ({
            label: String(d.getDate()),
            sub: d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' }),
            value: p.daily[dayKey(d)] || 0,
          }));
          const st = driverState(dd, p.active);
          return (
            <div className="driver-detail">
              <div className="person-row">
                <span className="avatar lg">{initials(dd.name)}</span>
                <span className="grow"><strong>{dd.name}</strong><small className="muted">{dd.vehicle} · {dd.vehicleNo}</small></span>
                <StatusBadge tone={st.tone} label={st.label} />
              </div>
              <div className="mini-grid">
                {PERIODS.map(([k, label]) => (
                  <div key={k} className="mini"><small>{label}</small><b>{p[k].rides}</b><span>{km(p[k].km)}</span></div>
                ))}
              </div>
              <div className="kv"><span>Active deliveries now</span><b>{p.active}</b></div>
              <div className="kv"><span>Avg distance / ride</span><b>{p.lifetime.rides ? km(p.lifetime.km / p.lifetime.rides) : '—'}</b></div>
              {dd.rating != null && <div className="kv"><span>Rating</span><b>★ {dd.rating}</b></div>}
              <h4 className="sub-head">Deliveries per day · last 14 days</h4>
              <BarChart data={chart} format={(v) => `${v} deliveries`} height={120} title={`${dd.name} daily deliveries`} />
              <a className="btn btn-primary btn-block mt" href={telHref(dd.phone)}><Phone size={16} /> Call {dd.name.split(' ')[0]}</a>
            </div>
          );
        })()}
      </BottomSheet>
    </div>
  );
}
