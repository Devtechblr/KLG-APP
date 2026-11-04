import { useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';

// "Swipe to confirm" slider. Drag the knob to the end to fire onConfirm.
// Keyboard users press Enter/Space on the knob instead.
export default function SwipeButton({ label, onConfirm, tone = 'orange' }) {
  const track = useRef(null);
  const start = useRef(null);
  const [x, setXState] = useState(0);
  const [dragging, setDragging] = useState(false);
  const xRef = useRef(0);
  const drag = useRef(false);
  const setX = (v) => { xRef.current = v; setXState(v); };

  const max = () => (track.current ? track.current.clientWidth - 52 : 0);

  const down = (e) => {
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
    if (xRef.current >= max() * 0.85) {
      setX(max());
      setTimeout(() => { setX(0); onConfirm(); }, 180);
    } else setX(0);
  };

  const progress = max() ? x / max() : 0;

  return (
    <div className={`swipe swipe-${tone}`} ref={track}>
      <span className="swipe-fill" style={{ width: x + 52 }} />
      <span className="swipe-label" style={{ opacity: 1 - progress * 1.2 }}>{label}</span>
      <button
        type="button"
        className={`swipe-knob ${dragging ? 'is-dragging' : ''}`}
        style={{ transform: `translateX(${x}px)` }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onConfirm(); } }}
        aria-label={label}
      >
        <ArrowRight size={20} />
      </button>
    </div>
  );
}
