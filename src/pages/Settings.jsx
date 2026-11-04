import { useEffect, useState } from 'react';
import { Store, UserCircle2, Bell, Users, Cog, ChevronDown, RotateCcw, FlaskConical, BellRing } from 'lucide-react';
import PageHeader from '../components/mobile/PageHeader';
import LoadingSkeleton from '../components/mobile/LoadingSkeleton';
import { useData, useUi } from '../context/DataContext';
import { API_BASE_URL, POLL_MS, USE_MOCK_DATA } from '../config';
import { useSession } from '../context/SessionContext';
import { alertUser, enableAdminPush, pushStatus } from '../services/native/notifications';

function LiveSettings() {
  const { session } = useSession();
  const { toast } = useUi();
  const [push, setPush] = useState(null);

  useEffect(() => { pushStatus().then(setPush); }, []);

  const enable = async () => {
    const r = await enableAdminPush();
    setPush(await pushStatus());
    toast(r.enabled ? 'Order alerts are on for this phone' : `Could not turn on alerts: ${r.reason || 'unknown'}`, r.enabled ? 'success' : 'danger');
  };

  const pushText = !push ? 'Checking…'
    : push.enabled ? 'On – this phone rings for every new delivery order, even when the app is closed.'
    : push.reason === 'web' ? 'Push alerts work in the Android app. In the browser you get alerts only while this tab is open.'
    : `Off – ${push.reason || 'not registered'}`;

  return (
    <div className="page">
      <PageHeader title="Settings" subtitle="Account, alerts and connection" />

      <Section icon={UserCircle2} title="Profile" desc="Your KLG account" defaultOpen>
        <div className="kv"><span>Name</span><b>{session?.name}</b></div>
        {session?.email && <div className="kv"><span>Email</span><b>{session.email}</b></div>}
        <div className="kv"><span>Role</span><b>{session?.adminRole}</b></div>
        <p className="muted small">Change your password or add admins on the KLG admin website.</p>
      </Section>

      <Section icon={Bell} title="Order alerts" desc="New delivery order notifications" defaultOpen>
        <p className="push-state">{pushText}</p>
        {push && !push.enabled && push.reason !== 'web' && (
          <button className="btn btn-primary btn-block mt" onClick={enable}><BellRing size={16} /> Turn on alerts</button>
        )}
        <button className="btn btn-ghost btn-block mt" onClick={() => alertUser({ title: 'Test alert', body: 'KLG Delivery alerts are working.', ring: true })}>
          Send a test alert
        </button>
      </Section>

      <Section icon={Cog} title="Application" desc="Connection details">
        <div className="kv"><span>Data source</span><b>KLG production API</b></div>
        <div className="kv"><span>Server</span><b className="small">{API_BASE_URL.replace(/^https?:\/\//, '')}</b></div>
        <div className="kv"><span>Auto refresh</span><b>every {Math.round(POLL_MS / 1000)} s</b></div>
        <p className="muted small">Menu, store hours and staff accounts are managed on the KLG admin website.</p>
      </Section>
    </div>
  );
}

// NOTE: The live site has /admin/settings and /admin/admin-users, but their fields were
// not visible to this account. These sections are local, demo-only placeholders and are
// not persisted to any server.
function Section({ icon: Icon, title, desc, children, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <section className="card set-section">
      <button className="set-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="more-icon"><Icon size={20} /></span>
        <span className="grow"><strong>{title}</strong><small className="muted">{desc}</small></span>
        <ChevronDown size={18} className={`chev ${open ? 'up' : ''}`} />
      </button>
      <div className={`collapse ${open ? 'is-open' : ''}`}><div className="set-body">{children}</div></div>
    </section>
  );
}

export default function Settings() {
  return USE_MOCK_DATA ? <DemoSettings /> : <LiveSettings />;
}

function DemoSettings() {
  const { db, loading, actions } = useData();
  const { toast, confirm } = useUi();
  const [restaurant, setRestaurant] = useState({ name: 'Krishna Leela Grand', tagline: 'Pure Vegetarian Restaurant', phone: '' });
  const [notif, setNotif] = useState({ sound: true, newOrder: true, ready: true });

  if (loading || !db) return <LoadingSkeleton rows={4} />;

  const save = (e) => { e.preventDefault(); toast('Saved locally (demo)'); };
  const reset = async () => {
    if (await confirm({ title: 'Reset demo data?', message: 'All demo orders and driver changes will be restored to the original sample data.', confirmLabel: 'Reset', danger: true })) actions.reset();
  };

  return (
    <div className="page">
      <PageHeader title="Settings" subtitle="Profile, notifications and demo data" />

      <Section icon={Store} title="Restaurant details" desc="Name and contact shown on receipts" defaultOpen>
        <form className="form" onSubmit={save}>
          <label className="field"><span>Restaurant name</span><input value={restaurant.name} onChange={(e) => setRestaurant({ ...restaurant, name: e.target.value })} /></label>
          <label className="field"><span>Tagline</span><input value={restaurant.tagline} onChange={(e) => setRestaurant({ ...restaurant, tagline: e.target.value })} /></label>
          <label className="field"><span>Contact number</span><input value={restaurant.phone} inputMode="tel" placeholder="Restaurant phone" onChange={(e) => setRestaurant({ ...restaurant, phone: e.target.value.replace(/[^\d+ ]/g, '') })} /></label>
          <button className="btn btn-primary btn-block" type="submit">Save</button>
        </form>
      </Section>

      <Section icon={UserCircle2} title="Profile" desc="Your admin account">
        <div className="kv"><span>Name</span><b>{db.adminUsers[0].name}</b></div>
        <div className="kv"><span>Role</span><b>{db.adminUsers[0].role}</b></div>
        <p className="muted small">Password changes are handled by the existing sign-in system.</p>
      </Section>

      <Section icon={Bell} title="Notifications" desc="Delivery order alerts">
        {[['newOrder', 'New delivery order alerts'], ['ready', 'Order ready for pickup'], ['sound', 'Play alert sound']].map(([k, l]) => (
          <label key={k} className="switch row">
            <input type="checkbox" checked={notif[k]} onChange={(e) => { setNotif({ ...notif, [k]: e.target.checked }); toast(`${l}: ${e.target.checked ? 'on' : 'off'}`, 'info'); }} />
            <span className="switch-track" /><span className="switch-text">{l}</span>
          </label>
        ))}
      </Section>

      <Section icon={Users} title="User management" desc={`${db.adminUsers.length} admin users`}>
        <ul className="rank-list">
          {db.adminUsers.map((u) => (
            <li key={u.id}><span className="grow"><strong>{u.name}</strong><small className="muted">{u.email}</small></span><span className="tag">{u.role}</span></li>
          ))}
        </ul>
        <p className="muted small">Adding admins uses the existing sign-up flow.</p>
      </Section>

      <Section icon={Cog} title="Application" desc="Data source and demo tools">
        <div className="kv"><span>Data source</span><b>{USE_MOCK_DATA ? 'Demo data (local only)' : 'Production API'}</b></div>
        {USE_MOCK_DATA && (
          <>
            <p className="muted small"><FlaskConical size={13} /> Mock mode is enabled with <code>VITE_USE_MOCK_DATA=true</code>. Changes stay in this browser.</p>
            <button className="btn btn-danger-soft btn-block" onClick={reset}><RotateCcw size={16} /> Reset demo data</button>
          </>
        )}
      </Section>
    </div>
  );
}
