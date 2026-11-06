import { useMemo, useState } from 'react';
import { Check, Phone, Star, Users } from 'lucide-react';
import BottomSheet from './BottomSheet';
import SearchBar from './SearchBar';
import { useData } from '../../context/DataContext';
import { initials, telHref } from '../../utils/format';
import { onRoad } from '../../utils/status';
import { USE_MOCK_DATA } from '../../config';

const ALL = 'ALL';

/**
 * Pick who delivers an order:
 *  - "All online drivers": every free online driver's phone rings, first to accept gets it
 *  - one driver from the list: only that driver's phone rings
 */
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
      .sort((a, b) => Number(b.online) - Number(a.online) || a.load - b.load || a.name.localeCompare(b.name));
  }, [db]);
  const shown = drivers.filter((d) => d.name.toLowerCase().includes(q.toLowerCase()) || (d.phone || '').includes(q));
  const onlineCount = drivers.filter((d) => d.online).length;

  const current = order?.driverId;
  const offeredToAll = !!order && !current && order.assignmentMode === 'AUTO';
  const canAll = !USE_MOCK_DATA;
  const choose = selected ?? (current || (canAll ? ALL : null));
  const chosenDriver = choose && choose !== ALL ? drivers.find((d) => d.id === choose) : null;
  const unchanged = (choose === ALL && offeredToAll) || (choose === current && !!current);

  const close = () => { setSelected(null); setQ(''); onClose(); };
  const submit = () => {
    if (!choose || unchanged) { close(); return; }
    if (choose === ALL) actions.autoAssign(order.id);
    else actions.assignDriver(order.id, choose);
    close();
  };

  const pickable = (d) => USE_MOCK_DATA || d.online;
  const label = choose === ALL
    ? (offeredToAll ? 'Already sent to all drivers' : `Send to all online drivers${onlineCount ? ` (${onlineCount})` : ''}`)
    : chosenDriver ? (unchanged ? `${chosenDriver.name} is assigned` : `Assign to ${chosenDriver.name}`) : 'Select a driver';

  return (
    <BottomSheet
      open={open}
      onClose={close}
      title={current ? 'Change Driver' : 'Assign Driver'}
      tall
      footer={<button className="btn btn-primary btn-block" disabled={!choose || unchanged} onClick={submit}>{label}</button>}
    >
      {order && <p className="sheet-sub">Order <b>{order.id}</b></p>}

      {canAll && (
        <>
          <p className="ad-label">Option 1</p>
          <div
            className={`ad-all ${choose === ALL ? 'is-active' : ''}`}
            role="radio"
            aria-checked={choose === ALL}
            tabIndex={0}
            onClick={() => setSelected(ALL)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelected(ALL)}
          >
            <span className="ad-all-ic"><Users size={20} /></span>
            <span className="ad-all-body">
              <strong>All online drivers</strong>
              <small>{offeredToAll ? 'Already sent · waiting for a driver to accept' : `${onlineCount} online · every phone rings, first to accept gets it`}</small>
            </span>
            <span className="radio">{choose === ALL && <Check size={14} />}</span>
          </div>
          <p className="ad-label">Option 2 · choose one driver</p>
        </>
      )}

      {drivers.length > 5 && <SearchBar value={q} onChange={setQ} placeholder="Search drivers" />}
      {shown.length === 0 && <p className="muted small ad-empty">{drivers.length ? 'No driver matches.' : 'No drivers yet. Add them under Drivers.'}</p>}
      <ul className="pick-list">
        {shown.map((d) => (
          <li key={d.id}>
            <div
              className={`pick ${choose === d.id ? 'is-active' : ''} ${!d.online ? 'is-off' : ''}`}
              role="radio"
              aria-checked={choose === d.id}
              tabIndex={0}
              aria-disabled={!pickable(d)}
              onClick={() => pickable(d) && setSelected(d.id)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && pickable(d) && setSelected(d.id)}
            >
              <span className="avatar">{initials(d.name)}<i className={`presence ${d.online ? 'on' : ''}`} /></span>
              <span className="pick-body">
                <strong>{d.name}{d.id === current && <em className="tag">Current</em>}</strong>
                <small>
                  {!d.online ? 'Offline' : d.load ? `On ${d.load} deliver${d.load > 1 ? 'ies' : 'y'}` : 'Free'}
                  {d.rating != null && <> · <Star size={11} className="star" /> {d.rating}</>}
                </small>
              </span>
              {d.phone && (
                <a className="icon-btn sm" href={telHref(d.phone)} onClick={(e) => e.stopPropagation()} aria-label={`Call ${d.name}`}>
                  <Phone size={16} />
                </a>
              )}
              <span className="radio">{choose === d.id && <Check size={14} />}</span>
            </div>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
