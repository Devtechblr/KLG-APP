import { Check } from 'lucide-react';
import BottomSheet from './BottomSheet';
import StatusBadge from './StatusBadge';
import { STATUS } from '../../utils/status';

// Status picker presented as a bottom sheet.
export default function FilterSheet({ open, onClose, title = 'Filter by status', options, value, onChange, counts = {} }) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <ul className="option-list">
        {options.map((o) => (
          <li key={o.value}>
            <button className={`option ${value === o.value ? 'is-active' : ''}`} onClick={() => { onChange(o.value); onClose(); }}>
              {STATUS[o.value] ? <StatusBadge status={o.value} /> : <span className="option-label">{o.label}</span>}
              <span className="option-count">{counts[o.value] ?? ''}</span>
              <span className="option-check">{value === o.value && <Check size={18} />}</span>
            </button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
