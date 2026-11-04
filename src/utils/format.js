export const inr = (n, dp = 0) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });
export const inr2 = (n) => inr(n, 2);

export const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
export const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
export const fmtDateTime = (iso) => `${fmtDate(iso)}, ${fmtTime(iso)}`;
export const fmtLongDate = (d) =>
  new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
export const dayKey = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const DAY_MS = 86400000;

export const telHref = (p) => `tel:+91${String(p).replace(/\D/g, '').slice(-10)}`;
export const mapsHref = (address) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
export const initials = (name = '') => name.split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase();
export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
};

// Date range presets used by DateFilter
export function rangeFor(preset, custom) {
  const today = startOfDay();
  const end = new Date(today.getTime() + DAY_MS - 1);
  switch (preset) {
    case 'today': return [today, end];
    case 'yesterday': return [new Date(today.getTime() - DAY_MS), new Date(today.getTime() - 1)];
    case '7d': return [new Date(today.getTime() - 6 * DAY_MS), end];
    case '30d': return [new Date(today.getTime() - 29 * DAY_MS), end];
    case 'month': return [new Date(today.getFullYear(), today.getMonth(), 1), end];
    case 'custom': {
      const from = custom?.from ? startOfDay(new Date(custom.from)) : new Date(0);
      const to = custom?.to ? new Date(startOfDay(new Date(custom.to)).getTime() + DAY_MS - 1) : end;
      return [from, to];
    }
    default: return [new Date(0), new Date(8640000000000000)];
  }
}
export const inRange = (iso, [a, b]) => { const t = new Date(iso).getTime(); return t >= a.getTime() && t <= b.getTime(); };
