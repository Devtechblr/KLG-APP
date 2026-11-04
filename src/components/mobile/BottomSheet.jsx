import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Bottom sheet on mobile, centered dialog on wider screens.
export default function BottomSheet({ open, onClose, title, children, footer, tall }) {
  const [render, setRender] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setRender(true);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      document.body.classList.add('no-scroll');
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    document.body.classList.remove('no-scroll');
    const t = setTimeout(() => setRender(false), 260);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [open, onClose]);

  if (!render) return null;
  return createPortal(
    <div className={`sheet-root ${visible ? 'is-open' : ''}`}>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className={`sheet ${tall ? 'sheet-tall' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-grab" />
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
