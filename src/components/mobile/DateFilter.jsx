import { CalendarDays } from 'lucide-react';

export const DATE_PRESETS = [
  { key: 'all', label: 'All time' },
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'month', label: 'This month' },
  { key: 'custom', label: 'Custom' },
];

export default function DateFilter({ value, onChange, custom, onCustom, presets = DATE_PRESETS }) {
  return (
    <div className="date-filter">
      <div className="chips" role="tablist" aria-label="Date range">
        {presets.map((p) => (
          <button
            key={p.key}
            role="tab"
            aria-selected={value === p.key}
            className={`chip ${value === p.key ? 'is-active' : ''}`}
            onClick={() => onChange(p.key)}
          >
            {p.key === 'custom' && <CalendarDays size={14} />} {p.label}
          </button>
        ))}
      </div>
      {value === 'custom' && (
        <div className="custom-range">
          <label>From<input type="date" value={custom?.from || ''} onChange={(e) => onCustom({ ...custom, from: e.target.value })} /></label>
          <label>To<input type="date" value={custom?.to || ''} onChange={(e) => onCustom({ ...custom, to: e.target.value })} /></label>
        </div>
      )}
    </div>
  );
}
