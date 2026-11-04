import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { useUi } from '../../context/DataContext';

export default function ConfirmDialog() {
  const { confirmState, setConfirmState } = useUi();
  if (!confirmState) return null;
  const close = (v) => { confirmState.resolve(v); setConfirmState(null); };
  return createPortal(
    <div className="confirm-root">
      <div className="sheet-backdrop" onClick={() => close(false)} />
      <div className="confirm" role="alertdialog" aria-modal="true" aria-label={confirmState.title}>
        <div className={`confirm-icon ${confirmState.danger ? 'is-danger' : ''}`}><AlertTriangle size={24} /></div>
        <h3>{confirmState.title}</h3>
        {confirmState.message && <p>{confirmState.message}</p>}
        <div className="confirm-actions">
          <button className="btn btn-ghost" onClick={() => close(false)}>{confirmState.cancelLabel || 'Go back'}</button>
          <button className={`btn ${confirmState.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)} autoFocus>
            {confirmState.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
