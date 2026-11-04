import { DAY_MS, dayKey, startOfDay } from './format';
import { onRoad } from './status';

export function periodStarts(now = new Date()) {
  const today = startOfDay(now);
  const dow = (today.getDay() + 6) % 7; // Monday = 0
  return {
    today,
    week: new Date(today.getTime() - dow * DAY_MS),
    month: new Date(today.getFullYear(), today.getMonth(), 1),
    lifetime: new Date(0),
  };
}

const empty = () => ({ rides: 0, km: 0 });

// Per-driver delivery stats computed from delivered orders.
export function computeDriverStats(db, range) {
  const starts = periodStarts();
  const per = {};
  db.drivers.forEach((d) => {
    per[d.id] = { today: empty(), week: empty(), month: empty(), lifetime: empty(), range: empty(), active: 0, daily: {} };
  });
  db.orders.forEach((o) => {
    if (!o.driverId || !per[o.driverId]) return;
    const p = per[o.driverId];
    if (onRoad(o)) p.active += 1;
    if (o.status !== 'DELIVERED') return;
    const doneAt = o.timeline?.find((x) => x.status === 'DELIVERED')?.at || o.createdAt;
    const t = new Date(doneAt).getTime();
    const dist = o.distanceKm || 0;
    for (const k of ['today', 'week', 'month', 'lifetime']) {
      if (t >= starts[k].getTime()) { p[k].rides += 1; p[k].km += dist; }
    }
    if (range && t >= range[0].getTime() && t <= range[1].getTime()) { p.range.rides += 1; p.range.km += dist; }
    const dk = dayKey(doneAt);
    p.daily[dk] = (p.daily[dk] || 0) + 1;
  });
  return per;
}

export function totals(per, key) {
  return Object.values(per).reduce((a, p) => ({ rides: a.rides + p[key].rides, km: a.km + p[key].km }), empty());
}

export function lastNDays(n) {
  const today = startOfDay();
  return Array.from({ length: n }, (_, i) => new Date(today.getTime() - (n - 1 - i) * DAY_MS));
}

export const km = (v) => `${v.toFixed(1)} km`;
export const driverState = (d, active) => (active > 0 ? { label: 'On delivery', tone: 'orange' } : d.online ? { label: 'Online', tone: 'success' } : { label: 'Offline', tone: 'neutral' });
