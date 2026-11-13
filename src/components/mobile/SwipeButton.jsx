import { useRef, useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';

// "Swipe to confirm" slider. Drag the knob to the end to fire onConfirm.
// Keyboard users press Enter/Space on the knob instead.
// While onConfirm's promise runs, the knob stays at the end with a spinner
// so the driver sees the swipe registered and can't fire it twice.
export default function SwipeButton({ label, onConfirm, tone = 'orange' }) {
  const track = useRef(null);
  const start = useRef(null);
  const [x, setXState] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const xRef = useRef(0);
  const drag = useRef(false);
  const setX = (v) => { xRef.current = v; setXState(v); };

  const max = () => (track.current ? track.current.clientWidth - 52 : 0);

  const fire = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setX(max());
    try { await onConfirm(); } finally {
      busyRef.current = false;
      setBusy(false);
      setX(0);
    }
  };

  const down = (e) => {
    if (busyRef.current) return;
    start.current = e.clientX - xRef.current;
    drag.current = true;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    if (!drag.current) return;
    setX(Math.min(max(), Math.max(0, e.clientX - start.current)));
  };
  const up = (e) => {
    if (!drag.current) return;
    move(e);
    drag.current = false;
    setDragging(false);
    if (xRef.current >= max() * 0.85) fire();
    else setX(0);
  };

  const progress = max() ? x / max() : 0;

  return (
    <div className={`swipe swipe-${tone} ${busy ? 'is-busy' : ''}`} ref={track} aria-busy={busy}>
      <span className="swipe-fill" style={{ width: x + 52 }} />
      <span className="swipe-label" style={{ opacity: busy ? 1 : 1 - progress * 1.2 }}>{busy ? 'Please wait…' : label}</span>
      <button
        type="button"
        className={`swipe-knob ${dragging ? 'is-dragging' : ''}`}
        style={{ transform: `translateX(${x}px)` }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(); } }}
        aria-label={label}
        disabled={busy}
      >
        {busy ? <Loader2 size={20} className="spin" /> : <ArrowRight size={20} />}
      </button>
    </div>
  );
}
