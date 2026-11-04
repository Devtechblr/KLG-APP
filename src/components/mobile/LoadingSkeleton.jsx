export default function LoadingSkeleton({ rows = 3, stats = 0 }) {
  return (
    <div className="skeleton-wrap" aria-busy="true" aria-label="Loading">
      {stats > 0 && (
        <div className="stat-grid">
          {Array.from({ length: stats }).map((_, i) => <div key={i} className="sk sk-stat" />)}
        </div>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card sk-card">
          <div className="sk sk-line w60" />
          <div className="sk sk-line w40" />
          <div className="sk sk-line w90" />
          <div className="sk sk-line w75" />
        </div>
      ))}
    </div>
  );
}
