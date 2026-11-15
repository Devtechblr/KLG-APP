// Menu items ON/OFF for all customers (MenuItem.isAvailable on the server,
// same switch as the admin website's Food Items page). Opened from the
// top bar; no PIN — the order desk asked for plain toggle switches.
import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Utensils, UtensilsCrossed } from 'lucide-react';
import BottomSheet from './BottomSheet';
import SearchBar from './SearchBar';
import { apiService } from '../../services/api/apiService';
import { friendlyError } from '../../utils/errors';
import { useUi } from '../../context/DataContext';

const itemsError = (e) => {
  if (e.status === 403) return 'Your login cannot change menu items. Ask an Admin.';
  if (e.status === 404) return 'Needs the latest KLG server update.';
  return friendlyError(e);
};

function ItemList() {
  const { toast } = useUi();
  const [data, setData] = useState(null); // { items, categories }
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(() => new Set());

  const load = () => {
    setError('');
    apiService.actions.staffMenu().then(setData).catch((e) => setError(itemsError(e)));
  };
  useEffect(load, []);

  const items = data?.items || [];
  const catName = useMemo(() => Object.fromEntries((data?.categories || []).map((c) => [c.slug, c.name])), [data]);
  const cats = useMemo(
    () => [...new Set(items.map((i) => i.category))].sort((a, b) => (catName[a] || a).localeCompare(catName[b] || b)),
    [items, catName]
  );

  if (error) {
    return (
      <div className="pin-pad">
        <p className="pin-error" role="alert">{error}</p>
        <button className="btn btn-ghost" onClick={load}><RefreshCw size={16} /> Try again</button>
      </div>
    );
  }
  if (!data) return <p className="muted small">Loading items…</p>;

  const q = query.trim().toLowerCase();
  const shown = items.filter((i) => (!category || i.category === category) && (!q || i.name.toLowerCase().includes(q)));
  const offCount = items.filter((i) => !i.isAvailable).length;

  const setOne = (id, isAvailable) => setData((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, isAvailable } : i)) }));
  const flip = async (item, on) => {
    setBusy((b) => new Set(b).add(item.id));
    setOne(item.id, on);
    try {
      await apiService.actions.setItemAvailable(item.id, on);
      toast(`${item.name}: ${on ? 'ON' : 'OFF'}`, on ? 'success' : 'info');
    } catch (e) {
      setOne(item.id, !on);
      toast(itemsError(e), 'danger');
    }
    setBusy((b) => { const n = new Set(b); n.delete(item.id); return n; });
  };

  return (
    <>
      <div className="staff-head">
        <div>
          <strong>Menu items</strong>
          <small className="muted">ON = customers can order it. OFF = hidden for all customers.{offCount ? ` ${offCount} OFF.` : ''}</small>
        </div>
        <select className="select" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {cats.map((c) => <option key={c} value={c}>{catName[c] || c}</option>)}
        </select>
      </div>
      <SearchBar value={query} onChange={setQuery} placeholder="Search items…" />
      {shown.length === 0 ? (
        <p className="muted small">No items found.</p>
      ) : (
        <ul className="staff-items">
          {shown.map((item) => (
            <li key={item.id}>
              <label className={`staff-item switch ${item.isAvailable ? '' : 'is-off'}`}>
                {item.imageUrl
                  ? <img src={item.imageUrl} alt="" loading="lazy" />
                  : <span className="staff-noimg"><Utensils size={18} /></span>}
                <span className="grow">
                  <strong>{item.name}</strong>
                  <small className={item.isAvailable ? 'is-on' : ''}>{item.isAvailable ? 'ON' : 'OFF · hidden from customers'}</small>
                </span>
                <input
                  type="checkbox"
                  checked={item.isAvailable}
                  disabled={busy.has(item.id)}
                  aria-label={item.name}
                  onChange={(e) => flip(item, e.target.checked)}
                />
                <span className="switch-track" />
              </label>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function StaffControls() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Menu items on / off">
        <UtensilsCrossed size={19} />
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Menu items ON / OFF" tall>
        {open && <ItemList />}
      </BottomSheet>
    </>
  );
}
