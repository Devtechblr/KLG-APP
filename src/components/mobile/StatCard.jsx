export default function StatCard({ icon: Icon, label, value, sub, tone = 'orange', onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`stat-card tone-${tone}`} onClick={onClick}>
      <span className="stat-icon"><Icon size={18} /></span>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </Tag>
  );
}
