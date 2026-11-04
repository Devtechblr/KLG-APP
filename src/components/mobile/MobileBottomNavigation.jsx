import { useLocation, useNavigate } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { PRIMARY_NAV, MORE_NAV } from '../layout/nav';

export default function MobileBottomNavigation({ onMore, moreOpen, badges = {} }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isActive = (item) => (item.match || [item.to]).some((p) => pathname.startsWith(p));
  const moreActive = !PRIMARY_NAV.some(isActive) && MORE_NAV.some((m) => pathname.startsWith(m.to));

  return (
    <nav className="m-bottom-nav" aria-label="Primary">
      {PRIMARY_NAV.map((item) => {
        const active = isActive(item) && !moreOpen;
        const Icon = item.icon;
        const count = item.badge ? badges[item.badge] : 0;
        return (
          <button
            key={item.to}
            className={`bn-item ${active ? 'is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => navigate(item.to)}
          >
            <span className="bn-icon">
              <Icon size={22} strokeWidth={active ? 2.4 : 2} />
              {count > 0 && <span className="bn-badge">{count > 99 ? '99+' : count}</span>}
            </span>
            <span className="bn-label">{item.label}</span>
          </button>
        );
      })}
      <button className={`bn-item ${moreActive || moreOpen ? 'is-active' : ''}`} onClick={onMore} aria-expanded={moreOpen}>
        <span className="bn-icon"><MoreHorizontal size={22} /></span>
        <span className="bn-label">More</span>
      </button>
    </nav>
  );
}
