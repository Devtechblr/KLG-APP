import { useEffect, useRef } from 'react';
import { useData, useUi } from '../../context/DataContext';
import { AUTO_ACCEPT_AFTER_MS } from '../../utils/status';
import { autoPrintOn, markPrinted, printOrder, wasPrinted } from '../../services/native/printer';
import { USE_MOCK_DATA } from '../../config';

const ACCEPTED = ['ACCEPTED', 'PREPARING'];
const RECENT_MS = 15 * 60_000; // auto-accepted while the app was closed: still print if this recent

/**
 * Admin side, live data only:
 *  - a new order nobody answers is accepted 60 s after it arrived
 *    (the server does the same; whichever is first wins)
 *  - every order accepted while this phone has a printer with auto-print on
 *    gets its receipt printed once (Accept button, popup, or auto-accept)
 *  Drivers are NOT contacted here: once the parcel is ready the admin taps
 *  "Assign Driver" and picks all online drivers or one driver.
 */
export default function useOrderAutomation() {
  const { db, actions, customerById } = useData();
  const { toast } = useUi();
  const seenPending = useRef(new Set());
  const accepting = useRef(new Set());
  const printing = useRef(new Set());
  const dbRef = useRef(db);
  dbRef.current = db;

  // Auto-accept timer.
  useEffect(() => {
    if (USE_MOCK_DATA) return undefined;
    const tick = () => {
      const orders = dbRef.current?.orders || [];
      orders.forEach((o) => {
        if (o.status !== 'PENDING' || accepting.current.has(o.id)) return;
        const start = new Date(o.pendingAt || o.createdAt).getTime();
        if (!Number.isFinite(start) || Date.now() < start + AUTO_ACCEPT_AFTER_MS) return;
        if (Date.now() - start > 30 * 60_000) return; // old leftovers: leave to a person
        accepting.current.add(o.id);
        actions.autoAccept(o.id);
      });
    };
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [actions]);

  // On accept: print the receipt.
  useEffect(() => {
    if (USE_MOCK_DATA || !db) return;
    db.orders.forEach((o) => {
      if (o.status === 'PENDING') { seenPending.current.add(o.id); return; }
      if (!ACCEPTED.includes(o.status)) return;
      const sawItWaiting = seenPending.current.has(o.id);
      const recentAuto = o.autoAccepted && o.acceptedAt && Date.now() - new Date(o.acceptedAt).getTime() < RECENT_MS;
      if (!sawItWaiting && !recentAuto) return;

      if (!autoPrintOn() || wasPrinted(o.id) || printing.current.has(o.id)) return;
      printing.current.add(o.id);
      markPrinted(o.id); // once per order, even if the printer is off (reprint from the card)
      printOrder(o, customerById[o.customerId])
        .then(() => toast(`Receipt printed · ${o.id}`))
        .catch((e) => toast(`Auto-print failed for ${o.id}: ${e.message || e}. Tap the printer icon to retry.`, 'danger'))
        .finally(() => printing.current.delete(o.id));
    });
  }, [db, customerById, toast, actions]);
}
