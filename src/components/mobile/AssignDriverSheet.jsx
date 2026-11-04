import { useMemo, useState } from 'react';
import { Check, Phone, Star, Radio } from 'lucide-react';
import BottomSheet from './BottomSheet';
import SearchBar from './SearchBar';
import { useData } from '../../context/DataContext';
import { initials, telHref } from '../../utils/format';
import { onRoad } from '../../utils/status';
import { USE_MOCK_DATA } from '../../config';

export default function AssignDriverSheet({ order, onClose }) {
  const { db, actions } = useData();
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  const open = !!order;

  const drivers = useMemo(() => {
    if (!db) return [];
    const load = {};
    db.orders.forEach((o) => { if (onRoad(o) && o.driverId) load[o.driverId] = (load[o.driverId] || 0) + 1; });
    return db.drivers
      .map((d) => ({ ...d, load: load[d.id] || 0 }))
      .filter((d) => d.name.toLowerCase().includes(q.toLowerCase()) || d.phone.includes(q))
      .sort((a, b) => Number(b.online) - Number(a.online) || a.load - b.load);
  }, [db, q]);

  const current = order?.driverId;
  const choose = selected ?? current;

  const offerAll = () => {
    actions.autoAssign(order.id);
    setSelected(null);
    onClose();
  };

  const submit = () => {
    if (!choose || choose === current) { onClose(); return; }
    actions.assignDriver(order.id, choose);
    setSelected(null);
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => { setSelected(null); onClose(); }}
      title={current ? 'Reassign Driver' : 'Assign Driver'}
      tall
      footer={
        <button className="btn btn-primary btn-block" disabled={!choose || choose === current} onClick={submit}>
          {current ? 'Reassign' : 'Assign'} {choose && choose !== current ? `to ${db.drivers.find((d) => d.id === choose)?.name}` : 'driver'}
        </button>
      }
    >
      {order && <p className="sheet-sub">For order <b>{order.id}</b>{order.offer || order.assignmentMode === 'AUTO' && !order.driverId ? ' · offered to all online drivers' : ''}</p>}
      {!USE_MOCK_DATA && (
        <button className="btn btn-ghost btn-block" onClick={offerAll}>
          <Radio size={16} /> Auto: offer to all online drivers (first to accept gets it)
        </button>
      )}
      <SearchBar value={q} onChange={setQ} placeholder="Search drivers" />
      <ul className="pick-list">
        {drivers.map((d) => (
          <li key={d.id}>
            <div
              className={`pick ${choose === d.id ? 'is-active' : ''} ${!d.online ? 'is-off' : ''}`}
              role="radio"
              aria-checked={choose === d.id}
              tabIndex={0}
              aria-disabled={!USE_MOCK_DATA && !d.online}
              onClick={() => (USE_MOCK_DATA || d.online) && setSelected(d.id)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (USE_MOCK_DATA || d.online) && setSelected(d.id)}
            >
              <span className="avatar">{initials(d.name)}<i className={`presence ${d.online ? 'on' : ''}`} /></span>
              <span className="pick-body">
                <strong>{d.name}{d.id === current && <em className="tag">Current</em>}</strong>
                <small>
                  {d.busy ? 'On a delivery' : d.online ? 'Online' : 'Offline'} · {d.load} active{d.rating != null && <> · <Star size={11} className="star" /> {d.rating}</>}
                </small>
              </span>
              <a className="icon-btn sm" href={telHref(d.phone)} onClick={(e) => e.stopPropagation()} aria-label={`Call ${d.name}`}>
                <Phone size={16} />
              </a>
              <span className="radio">{choose === d.id && <Check size={14} />}</span>
            </div>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
