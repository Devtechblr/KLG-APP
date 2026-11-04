import { Phone, Pencil, Star, Bike, ChevronRight } from 'lucide-react';
import { initials, telHref } from '../../utils/format';

export default function DriverCard({ driver, active = 0, today = 0, onView, onEdit, onToggle }) {
  return (
    <article className="card driver-card">
      <button className="drc-main" onClick={onView} aria-label={`View ${driver.name}`}>
        <span className="avatar lg">{initials(driver.name)}<i className={`presence ${driver.online ? 'on' : ''}`} /></span>
        <span className="drc-info">
          <strong>{driver.name}</strong>
          <small><Bike size={12} /> {driver.vehicle} · {driver.vehicleNo}</small>
          {driver.rating != null && <small><Star size={12} className="star" /> {driver.rating} rating</small>}
        </span>
        <ChevronRight size={18} className="muted" />
      </button>
      <div className="drc-stats">
        <span><b>{active}</b><small>Active</small></span>
        <span><b>{today}</b><small>Today</small></span>
        <span className={active > 0 ? 'busy' : driver.online ? 'free' : 'off'}>
          <b>{active > 0 ? 'Busy' : driver.online ? 'Free' : 'Off'}</b><small>Availability</small>
        </span>
      </div>
      <div className="drc-actions">
        <label className="switch" aria-label={`${driver.name} online`}>
          <input type="checkbox" checked={driver.online} onChange={onToggle} />
          <span className="switch-track" />
          <span className="switch-text">{driver.online ? 'Online' : 'Offline'}</span>
        </label>
        <a className="icon-btn sm" href={telHref(driver.phone)} aria-label={`Call ${driver.name}`}><Phone size={16} /></a>
        <button className="icon-btn sm" onClick={onEdit} aria-label={`Edit ${driver.name}`}><Pencil size={16} /></button>
      </div>
    </article>
  );
}
