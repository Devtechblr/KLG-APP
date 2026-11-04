import { useOutletContext } from 'react-router-dom';
import { LogOut, Star } from 'lucide-react';
import PageHeader from '../../components/mobile/PageHeader';
import { useData, useUi } from '../../context/DataContext';
import { useSession } from '../../context/SessionContext';
import { fmtDate, initials } from '../../utils/format';

export default function DriverProfile() {
  const { me } = useOutletContext();
  const { db, actions } = useData();
  const { confirm } = useUi();
  const { logout } = useSession();

  const total = db.orders.filter((o) => o.driverId === me.id && o.status === 'DELIVERED').length;

  const signOut = async () => {
    if (await confirm({ title: 'Log out?', confirmLabel: 'Log out', danger: true })) logout();
  };

  return (
    <div className="page">
      <PageHeader title="Profile" />
      <section className="card section driver-profile">
        <span className="avatar lg">{initials(me.name)}</span>
        <div>
          <h2>{me.name}</h2>
          <p className="muted small">{me.phone}</p>
        </div>
      </section>

      <section className="card section">
        <label className="switch row">
          <input type="checkbox" checked={!!me.online} disabled={me.busy} onChange={() => actions.toggleDriverOnline(me.id)} />
          <span className="switch-track" />
          <span className="switch-text">{me.busy ? 'On a delivery · finish it to go offline' : me.online ? 'Online · receiving orders' : 'Offline'}</span>
        </label>
      </section>

      <section className="card section">
        {me.vehicleNo && <div className="kv"><span>Vehicle</span><b>{me.vehicleNo}</b></div>}
        {me.rating != null && <div className="kv"><span>Rating</span><b><Star size={13} /> {me.rating}</b></div>}
        <div className="kv"><span>Total delivered</span><b>{db.stats ? db.stats.totalRides : total}</b></div>
        {db.stats && <div className="kv"><span>Total distance</span><b>{Number(db.stats.totalKm || 0).toFixed(1)} km</b></div>}
        {me.joinedAt && <div className="kv"><span>Joined</span><b>{fmtDate(me.joinedAt)}</b></div>}
      </section>

      <button className="btn btn-danger-soft btn-block" onClick={signOut}><LogOut size={18} /> Log out</button>
    </div>
  );
}
