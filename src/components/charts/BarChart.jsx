import { useState } from 'react';

// Single-series column chart. Tap/hover a bar to read its exact value.
// data: [{ label, value, sub? }]
export default function BarChart({ data, format = (v) => v, height = 150, title, minBarWidth = 22 }) {
  const [active, setActive] = useState(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const shown = active ?? data.length - 1;
  const cur = data[shown];

  return (
    <figure className="bar-chart" aria-label={title}>
      {cur && (
        <figcaption className="bc-readout">
          <span>{cur.sub || cur.label}</span>
          <strong>{format(cur.value)}</strong>
        </figcaption>
      )}
      <div className="bc-scroll">
        <div className="bc-plot" style={{ height, minWidth: data.length * minBarWidth }} onMouseLeave={() => setActive(null)}>
          {[0.5, 1].map((g) => <span key={g} className="bc-grid" style={{ bottom: `${g * 100}%` }} />)}
          {data.map((d, i) => (
            <button
              key={d.label + i}
              className={`bc-col ${i === shown ? 'is-active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => setActive(i)}
              aria-label={`${d.sub || d.label}: ${format(d.value)}`}
            >
              <span className="bc-bar" style={{ height: `${(d.value / max) * 100}%` }} />
            </button>
          ))}
        </div>
        <div className="bc-labels" style={{ minWidth: data.length * minBarWidth }}>
          {data.map((d, i) => <span key={d.label + i} className={i === shown ? 'is-active' : ''}>{d.label}</span>)}
        </div>
      </div>
    </figure>
  );
}
