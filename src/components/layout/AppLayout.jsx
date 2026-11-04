import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Bell, FlaskConical } from 'lucide-react';
import MobileHeader from '../mobile/MobileHeader';
import MobileBottomNavigation from '../mobile/MobileBottomNavigation';
import MobileDrawer from '../mobile/MobileDrawer';
import BrandMark from '../mobile/BrandMark';
import Toasts from '../mobile/Toasts';
import ConfirmDialog from '../mobile/ConfirmDialog';
import { DESKTOP_NAV } from './nav';
import { useData, useUi } from '../../context/DataContext';
import { ACTIVE_STATUSES } from '../../utils/status';
import { USE_MOCK_DATA } from '../../config';
import { useSession } from '../../context/SessionContext';

export default function AppLayout() {
  const { db, error } = useData();
  const { confirm } = useUi();
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { logout: endSession } = useSession();

  useEffect(() => { window.scrollTo({ top: 0 }); setMoreOpen(false); }, [pathname]);

  const badges = useMemo(() => ({
    activeDeliveries: db ? db.orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length : 0,
  }), [db]);

  const logout = async () => {
    if (await confirm({ title: 'Log out?', confirmLabel: 'Log out', danger: true })) { endSession(); navigate('/login', { replace: true }); }
  };

  return (
    <div className="app">
      {/* Desktop sidebar (>= 768px) */}
      <aside className="d-sidebar">
        <div className="d-brand">
          <BrandMark size={44} />
          <span><strong>Krishna Leela Grand</strong><small>Pure Vegetarian Restaurant</small></span>
        </div>
        <p className="d-section">Main</p>
        <nav className="d-nav">
          {DESKTOP_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to + item.label} to={item.to} className={({ isActive }) => `d-link ${isActive ? 'is-active' : ''}`}>
                <span className="d-link-icon"><Icon size={18} /></span>
                {item.label}
                {item.badge && badges[item.badge] > 0 && (
                  <span className="d-badge"><Bell size={14} /><i>{badges[item.badge]}</i></span>
                )}
              </NavLink>
            );
          })}
        </nav>
        <button className="d-logout" onClick={logout}><LogOut size={18} /> Logout</button>
      </aside>

      {/* Mobile header (< 768px) */}
      <MobileHeader />

      <main className="main">
        {USE_MOCK_DATA && (
          <div className="demo-banner"><FlaskConical size={14} /> Demo mode · sample data only, nothing is sent to the server</div>
        )}
        {error ? <div className="card error-card"><b>Could not load data.</b><p>{error}</p></div> : <Outlet />}
      </main>

      <MobileBottomNavigation onMore={() => setMoreOpen((v) => !v)} moreOpen={moreOpen} badges={badges} />
      <MobileDrawer open={moreOpen} onClose={() => setMoreOpen(false)} />
      <Toasts />
      <ConfirmDialog />
    </div>
  );
}
