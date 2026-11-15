// Staff Controls: lock icon in the top bar -> staff PIN -> switch menu items
// ON/OFF for all customers. Same PIN as the website's Staff Controls
// (admin website → Settings → Staff PIN & Security). The PIN is kept only in
// memory while the sheet is open; closing it locks again.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Lock, Utensils } from 'lucide-react';
import BottomSheet from './BottomSheet';
import SearchBar from './SearchBar';
import { apiService } from '../../services/api/apiService';
import { friendlyError } from '../../utils/errors';
import { useUi } from '../../context/DataContext';

const pinError = (e) => {
  if (e.status === 403 && e.body?.code === 'STAFF_PIN') return 'Wrong PIN. Try again.';
  if (e.status === 403) return 'Your login cannot change menu items. Ask an Admin.';
  if (e.status === 404) return 'Needs the latest KLG server update.';
  return friendlyError(e); // includes "Too many failed PIN attempts…"
};

function PinPad({ onUnlock }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => input.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  const submit = async (value) => {
    setBusy(true);
    setError('');
    try {
      const data = await apiService.actions.staffMenu(value);
      onUnlock(value, data);
    } catch (e) {
      setError(pinError(e));
      setPin('');
      setBusy(false);
      setTimeout(() => input.current?.focus(), 0);
    }
  };

  const change = (v) => {
    const digits = v.replace(/\D/g, '').slice(0, 4);
    setPin(digits);
    if (error) setError('');
    if (digits.length === 4) submit(digits);
  };

  return (
    <div className="pin-pad">
      <span className="pin-lock"><Lock size={26} /></span>
      <p className="sheet-sub">Enter the 4-digit staff PIN</p>
      <label className={`pin-boxes ${error ? 'is-error' : ''}`}>
        <input
          ref={input}
          className="pin-input"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={pin}
          disabled={busy}
          aria-label="Staff PIN"
          onChange={(e) => change(e.target.value)}
        />
        {[0, 1, 2, 3].map((i) => <span key={i} className={`pin-dot ${i < pin.length ? 'is-filled' : ''}`} />)}
      </label>
      {busy && <p className="muted small">Checking…</p>}
      {error && <p className="pin-error" role="alert">{error}</p>}
      <p className="muted small">The PIN is set on the KLG admin website → Settings → Staff PIN &amp; Security.</p>
    </div>
  );
}

function ItemList({ pin, initial }) {
  const { toast } = useUi();
  const [items, setItems] = useState(initial.items);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(() => new Set());

  const catName = useMemo(() => Object.fromEntries(initial.categories.map((c) => [c.slug, c.name])), [initial.categories]);
  const cats = useMemo(
    () => [...new Set(items.map((i) => i.category))].sort((a, b) => (catName[a] || a).localeCompare(catName[b] || b)),
    [items, catName]
  );

  const q = query.trim().toLowerCase();
  const shown = items.filter((i) => (!category || i.category === category) && (!q || i.name.toLowerCase().includes(q)));
  const offCount = items.filter((i) => !i.isAvailable).length;

  const setOne = (id, isAvailable) => setItems((list) => list.map((i) => (i.id === id ? { ...i, isAvailable } : i)));
  const flip = async (item, on) => {
    setBusy((b) => new Set(b).add(item.id));
    setOne(item.id, on);
    try {
      await apiService.actions.setItemAvailable(pin, item.id, on);
      toast(`${item.name}: ${on ? 'shown to customers' : 'hidden from customers'}`, on ? 'success' : 'info');
    } catch (e) {
      setOne(item.id, !on);
      toast(pinError(e), 'danger');
    }
    setBusy((b) => { const n = new Set(b); n.delete(item.id); return n; });
  };

  return (
    <>
      <div className="staff-head">
        <div>
          <strong>Menu items</strong>
          <small className="muted">Tick to show, untick to hide for all customers.{offCount ? ` ${offCount} hidden.` : ''}</small>
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
              <label className={`staff-item ${item.isAvailable ? '' : 'is-off'}`}>
                {item.imageUrl
                  ? <img src={item.imageUrl} alt="" loading="lazy" />
                  : <span className="staff-noimg"><Utensils size={18} /></span>}
                <span className="grow">
                  <strong>{item.name}</strong>
                  {!item.isAvailable && <small>Hidden from customers</small>}
                </span>
                <input
                  type="checkbox"
                  className="staff-check"
                  checked={item.isAvailable}
                  disabled={busy.has(item.id)}
                  aria-label={item.name}
                  onChange={(e) => flip(item, e.target.checked)}
                />
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
  const [unlocked, setUnlocked] = useState(null); // { pin, data }

  const close = () => { setOpen(false); setUnlocked(null); };

  return (
    <>
      <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Staff controls">
        <Lock size={19} />
      </button>
      <BottomSheet open={open} onClose={close} title="Staff Controls" tall={!!unlocked}>
        {open && (unlocked
          ? <ItemList pin={unlocked.pin} initial={unlocked.data} />
          : <PinPad onUnlock={(pin, data) => setUnlocked({ pin, data })} />)}
      </BottomSheet>
    </>
  );
}
