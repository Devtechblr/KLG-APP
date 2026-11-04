import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Bike, Phone, Gauge, ChevronRight, Pencil } from 'lucide-react';
import PageHeader from '../components/mobile/PageHeader';
import SearchBar from '../components/mobile/SearchBar';
import DriverCard from '../components/mobile/DriverCard';
import BottomSheet from '../components/mobile/BottomSheet';
import StatusBadge from '../components/mobile/StatusBadge';
import LoadingSkeleton from '../components/mobile/LoadingSkeleton';
import EmptyState from '../components/mobile/EmptyState';
import { useData } from '../context/DataContext';
import { fmtTime, initials, telHref } from '../utils/format';
import { computeDriverStats, driverState, km } from '../utils/driverStats';
import { ACTIVE_STATUSES } from '../utils/status';
import { USE_MOCK_DATA } from '../config';

const BLANK = { name: '', phone: '', email: '', password: '', vehicle: 'Bike', vehicleNo: '', online: true };

export function DriverForm({ initial, onSave, onCancel }) {
  const [f, setF] = useState({ ...BLANK, ...initial });
  const [touched, setTouched] = useState(false);
  const phoneOk = /^[6-9]\d{9}$/.test(f.phone);
  const isNew = !initial?.id;
  // Real accounts: a new driver needs a password to sign in (min 6 chars).
  const pwOk = USE_MOCK_DATA || (isNew ? f.password.length >= 6 : !f.password || f.password.length >= 6);
  const emailOk = !f.email || /^\S+@\S+\.\S+$/.test(f.email);
  const valid = f.name.trim().length >= 2 && phoneOk && f.vehicleNo.trim() && pwOk && emailOk;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); setTouched(true); if (valid) onSave({ ...f, name: f.name.trim(), email: f.email.trim().toLowerCase(), vehicleNo: f.vehicleNo.trim().toUpperCase() }); }}>
      <label className="field"><span>Full name</span>
        <input value={f.name} onChange={set('name')} placeholder="e.g. Ramesh Kumar" autoComplete="off" />
        {touched && f.name.trim().length < 2 && <em className="err">Enter the driver's name</em>}
      </label>
      <label className="field"><span>Mobile number</span>
        <div className="prefix-input"><b>+91</b><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} inputMode="numeric" placeholder="10-digit number" /></div>
        {touched && !phoneOk && <em className="err">Enter a valid 10-digit mobile number</em>}
      </label>
      {!USE_MOCK_DATA && (
        <>
          <label className="field"><span>Email (optional)</span>
            <input value={f.email} onChange={set('email')} inputMode="email" autoCapitalize="none" placeholder="driver@example.com" autoComplete="off" />
            {touched && !emailOk && <em className="err">Enter a valid email</em>}
          </label>
          <label className="field"><span>{isNew ? 'Password' : 'New password (leave blank to keep)'}</span>
            <input type="text" value={f.password} onChange={set('password')} placeholder="At least 6 characters" autoComplete="new-password" />
            {touched && !pwOk && <em className="err">At least 6 characters</em>}
            <small className="muted">The driver signs in with their mobile number and this password.</small>
          </label>
        </>
      )}
      <div className="field-row">
        <label className="field"><span>Vehicle</span>
          <select className="select" value={f.vehicle} onChange={set('vehicle')}>
            <option>Bike</option><option>Scooter</option><option>E-Bike</option><option>Bicycle</option>
          </select>
        </label>
        <label className="field"><span>Vehicle number</span>
          <input value={f.vehicleNo} onChange={set('vehicleNo')} placeholder="KA-05-AB-1234" />
          {touched && !f.vehicleNo.trim() && <em className="err">Required</em>}
        </label>
      </div>
      <label className="switch row">
        <input type="checkbox" checked={f.online} onChange={set('online')} />
        <span className="switch-track" />
        <span className="switch-text">Available for deliveries (online)</span>
      </label>
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">{initial?.id ? 'Save changes' : 'Add driver'}</button>
      </div>
    </form>
  );
}

export default function Drivers() {
  const { db, loading, actions, customerById } = useData();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('all');
  const [editing, setEditing] = useState(null); // {} for new, driver for edit
  const [viewing, setViewing] = useState(null);

  const stats = useMemo(() => (db ? computeDriverStats(db) : {}), [db]);

  if (loading || !db) return <LoadingSkeleton rows={4} />;

  const counts = { all: db.drivers.length, online: db.drivers.filter((d) => d.online).length, offline: db.drivers.filter((d) => !d.online).length };
  const list = db.drivers.filter((d) =>
    (tab === 'all' || (tab === 'online' ? d.online : !d.online)) &&
    (d.name.toLowerCase().includes(q.toLowerCase()) || d.phone.includes(q) || d.vehicleNo.toLowerCase().includes(q.toLowerCase())));
  const vd = viewing && db.drivers.find((d) => d.id === viewing);
  const vdOrders = vd ? db.orders.filter((o) => o.driverId === vd.id && !o.offer && ACTIVE_STATUSES.includes(o.status)) : [];

  return (
    <div className="page">
      <PageHeader
        title="Drivers"
        subtitle={`${counts.online} online · ${counts.offline} offline`}
        actions={<button className="btn btn-primary btn-sm" onClick={() => setEditing({})}><Plus size={16} /> Add</button>}
      />
      <SearchBar value={q} onChange={setQ} placeholder="Search name, phone, vehicle" />
      <div className="segmented" role="tablist">
        {['all', 'online', 'offline'].map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'is-active' : ''} onClick={() => setTab(k)}>
            {k[0].toUpperCase() + k.slice(1)} <em>{counts[k]}</em>
          </button>
        ))}
      </div>
      <button className="card link-card" onClick={() => navigate('/admin/driver-performance')}>
        <span className="more-icon"><Gauge size={20} /></span>
        <span className="grow"><strong>Driver Performance</strong><small className="muted">Rides & distance — today, week, month, lifetime</small></span>
        <ChevronRight size={18} className="muted" />
      </button>

      {list.length === 0 ? (
        <EmptyState icon={Bike} title="No drivers found" text="Try another search or add a new driver." action={<button className="btn btn-primary" onClick={() => setEditing({})}><Plus size={16} /> Add driver</button>} />
      ) : (
        <div className="card-grid">
          {list.map((d) => (
            <DriverCard
              key={d.id}
              driver={d}
              active={stats[d.id]?.active || 0}
              today={stats[d.id]?.today.rides || 0}
              onView={() => setViewing(d.id)}
              onEdit={() => setEditing(d)}
              onToggle={() => actions.toggleDriverOnline(d.id)}
            />
          ))}
        </div>
      )}

      <BottomSheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit driver' : 'Add driver'} tall>
        {editing && (
          <DriverForm
            key={editing.id || 'new'}
            initial={editing}
            onCancel={() => setEditing(null)}
            onSave={(d) => { actions.upsertDriver(d); setEditing(null); }}
          />
        )}
      </BottomSheet>

      <BottomSheet open={!!vd} onClose={() => setViewing(null)} title="Driver details" tall>
        {vd && (() => {
          const s = stats[vd.id];
          const st = driverState(vd, s.active);
          return (
            <div className="driver-detail">
              <div className="person-row">
                <span className="avatar lg">{initials(vd.name)}<i className={`presence ${vd.online ? 'on' : ''}`} /></span>
                <span className="grow"><strong>{vd.name}</strong><small className="muted">+91 {vd.phone}</small></span>
                <StatusBadge tone={st.tone} label={st.label} />
              </div>
              <div className="kv"><span>Vehicle</span><b>{vd.vehicle} · {vd.vehicleNo}</b></div>
              {vd.joinedAt && <div className="kv"><span>Joined</span><b>{new Date(vd.joinedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</b></div>}
              {vd.rating != null && <div className="kv"><span>Rating</span><b>★ {vd.rating}</b></div>}
              {vd.email && <div className="kv"><span>Email</span><b>{vd.email}</b></div>}
              <div className="mini-grid">
                <div className="mini"><small>Today</small><b>{s.today.rides}</b><span>{km(s.today.km)}</span></div>
                <div className="mini"><small>Lifetime</small><b>{s.lifetime.rides}</b><span>{km(s.lifetime.km)}</span></div>
              </div>
              <h4 className="sub-head">Assigned orders ({vdOrders.length})</h4>
              {vdOrders.length === 0 ? <p className="muted small">No active deliveries.</p> : (
                <ul className="mini-orders">
                  {vdOrders.map((o) => (
                    <li key={o.id}>
                      <button onClick={() => navigate(`/admin/delivery-orders/${o.id}`)}>
                        <span className="grow"><b>{o.id}</b><small>{customerById[o.customerId]?.name} · {fmtTime(o.createdAt)}</small></span>
                        <StatusBadge status={o.status} dot={false} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="row-2 mt">
                <a className="btn btn-ghost" href={telHref(vd.phone)}><Phone size={16} /> Call</a>
                <button className="btn btn-primary" onClick={() => { setViewing(null); setEditing(vd); }}><Pencil size={16} /> Edit</button>
              </div>
            </div>
          );
        })()}
      </BottomSheet>
    </div>
  );
}
