import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import { useUi } from '../../context/DataContext';

const ICON = { success: CheckCircle2, warning: AlertTriangle, danger: XCircle, info: Info };

export default function Toasts() {
  const { toasts } = useUi();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => {
        const I = ICON[t.tone] || Info;
        return <div key={t.id} className={`toast toast-${t.tone}`}><I size={18} /> <span>{t.message}</span></div>;
      })}
    </div>
  );
}
