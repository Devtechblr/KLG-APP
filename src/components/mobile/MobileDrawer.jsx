import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronRight, LogOut } from 'lucide-react';
import BottomSheet from './BottomSheet';
import { MORE_NAV } from '../layout/nav';
import { useUi } from '../../context/DataContext';
import { useSession } from '../../context/SessionContext';

export default function MobileDrawer({ open, onClose }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { confirm } = useUi();
  const { logout: endSession } = useSession();

  const go = (to) => { onClose(); navigate(to); };

  const logout = async () => {
    onClose();
    const ok = await confirm({ title: 'Log out?', message: 'You will need to sign in again to manage orders.', confirmLabel: 'Log out', danger: true });
    if (!ok) return;
    endSession();
    navigate('/login', { replace: true });
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="More">
      <ul className="more-list">
        {MORE_NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.to);
          return (
            <li key={item.to}>
              <button className={`more-item ${active ? 'is-active' : ''}`} onClick={() => go(item.to)}>
                <span className="more-icon"><Icon size={20} /></span>
                <span className="more-text"><strong>{item.label}</strong><small>{item.desc}</small></span>
                <ChevronRight size={18} className="muted" />
              </button>
            </li>
          );
        })}
        <li>
          <button className="more-item danger" onClick={logout}>
            <span className="more-icon"><LogOut size={20} /></span>
            <span className="more-text"><strong>Logout</strong><small>End this session</small></span>
          </button>
        </li>
      </ul>
    </BottomSheet>
  );
}
