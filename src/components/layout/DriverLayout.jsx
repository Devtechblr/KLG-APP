import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Bike, History, UserCircle2, FlaskConical } from 'lucide-react';
import Toasts from '../mobile/Toasts';
import ConfirmDialog from '../mobile/ConfirmDialog';
import LoadingSkeleton from '../mobile/LoadingSkeleton';
import DriverOfferAlert from '../mobile/DriverOfferAlert';
import DriverHeader from '../mobile/DriverHeader';
import { startLiveLocation, stopLiveLocation } from '../../services/native/location';
import { useData } from '../../context/DataContext';
import { useSession } from '../../context/SessionContext';
import { USE_MOCK_DATA } from '../../config';

// Statuses a driver acts on. Orders assigned while the kitchen is still working show as "upcoming".
export const DRIVER_ACTIVE = ['PENDING', 'ACCEPTED', 'PREPARING', 'PACKING', 'READY', 'ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY'];

const NAV = [
  { to: '/driver/active', label: 'Deliveries', icon: Bike, badge: true, match: '/driver/order' },
  { to: '/driver/history', label: 'History', icon: History },
  { to: '/driver/profile', label: 'Profile', icon: UserCircle2 },
];

export default function DriverLayout() {
  const { db, loading, error, driverById, actions } = useData();
  const { session, logout } = useSession();
  const { pathname } = useLocation();
  const me = driverById?.[session.driverId];
  const onOrderPage = pathname.startsWith('/driver/order');

  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);

  // While a delivery is out, share GPS with the backend (admin + customer live tracking).
  const outOrderId = useMemo(
    () => db?.orders.find((o) => o.driverId === session.driverId && o.status === 'OUT_FOR_DELIVERY')?.id || null,
    [db, session.driverId]
  );
  const lastSent = useRef(0);
  const [sharing, setSharing] = useState(null); // null | 'native' | 'web' | 'denied'
  useEffect(() => {
    if (USE_MOCK_DATA || !outOrderId) { setSharing(null); return undefined; }
    let cancelled = false;
    let watch = null;
    // Android: native foreground service keeps sending GPS with the screen off.
    startLiveLocation(outOrderId).then((res) => {
      if (cancelled) return;
      if (res.tracking) { setSharing('native'); return; }
      if (res.reason === 'permission') { setSharing('denied'); return; }
      if (!navigator.geolocation) { setSharing(null); return; }
      // Browser fallback: only while the app is open.
      watch = navigator.geolocation.watchPosition(
        (pos) => {
          setSharing('web');
          if (Date.now() - lastSent.current < 15000) return;
          lastSent.current = Date.now();
          actions.sendLocation?.(outOrderId, pos.coords);
        },
        () => setSharing('denied'),
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 }
      );
    });
    return () => {
      cancelled = true;
      if (watch != null) navigator.geolocation.clearWatch(watch);
      stopLiveLocation();
    };
  }, [outOrderId, actions]);

  const activeCount = useMemo(
    () => (db ? db.orders.filter((o) => o.driverId === session.driverId && DRIVER_ACTIVE.includes(o.status)).length : 0),
    [db, session.driverId]
  );

  // Demo data was reset or the driver was removed.
  if (db && !me) {
    return (
      <div className="login">
        <div className="card login-card">
          <h1>Driver not found</h1>
          <p className="muted">This driver no longer exists in the data.</p>
          <button className="btn btn-primary btn-block" onClick={logout}>Back to sign-in</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`app driver-app ${onOrderPage ? 'on-order' : ''}`}>
      {me && !onOrderPage && <DriverHeader me={me} />}
      <main className="main">
        {error ? <div className="card error-card"><b>Could not load data.</b><p>{error}</p></div>
          : loading || !me ? <LoadingSkeleton rows={3} />
          : <Outlet context={{ me, sharing }} />}
        {USE_MOCK_DATA && (
          <div className="demo-banner demo-foot"><FlaskConical size={14} /> Demo mode · sample data only</div>
        )}
      </main>

      <nav className="m-bottom-nav pill-nav" aria-label="Driver">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `bn-item ${isActive || (item.match && pathname.startsWith(item.match)) ? 'is-active' : ''}`}>
              <span className="bn-icon">
                <Icon size={22} />
                {item.badge && activeCount > 0 && <span className="bn-badge">{activeCount}</span>}
              </span>
              <span className="bn-label">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      {me && <DriverOfferAlert meId={me.id} />}
      <Toasts />
      <ConfirmDialog />
    </div>
  );
}
