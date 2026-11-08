import { useEffect } from 'react';
import { ringFor, stopRing } from '../services/native/notifications';

/**
 * Rings with the app's order sound while an alert screen shows `key`.
 * Also re-rings when the app comes back to the front: opening the app stops
 * the push's ring natively, but the screen is still asking for an answer.
 * Stops when the screen goes away (answered, hidden, or handled elsewhere).
 */
export default function useRingWhileShown(key, title, body) {
  useEffect(() => {
    if (!key) return undefined;
    let timer;
    const ring = () => {
      if (document.visibilityState !== 'visible') return;
      clearTimeout(timer);
      // After MainActivity.onResume's stop-all, which runs on resume too.
      timer = setTimeout(() => ringFor({ key, title, body }), 600);
    };
    ring();
    document.addEventListener('visibilitychange', ring);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', ring);
      stopRing(key);
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}
