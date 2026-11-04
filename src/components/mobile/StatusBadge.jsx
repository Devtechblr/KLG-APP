import { STATUS, PAYMENT } from '../../utils/status';

export default function StatusBadge({ status, payment, tone, label, dot = true }) {
  const meta = status ? STATUS[status] : payment ? PAYMENT[payment] : { tone, label };
  if (!meta) return null;
  return (
    <span key={status || payment || label} className={`badge badge-${meta.tone}`}>
      {dot && <span className="badge-dot" />}
      {meta.label}
    </span>
  );
}
