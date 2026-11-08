import { useCallback, useEffect, useState } from 'react';
import { openAlertSettings, pushStatus } from '../../services/native/notifications';

// Phone settings that decide whether a push can ring the phone while the app is closed.
// Oppo / Realme / Vivo / Xiaomi block pushes to swiped-away apps unless auto-launch is on.
export default function BackgroundAlerts() {
  const [push, setPush] = useState(null);
  const refresh = useCallback(() => pushStatus().then(setPush), []);

  useEffect(() => {
    refresh();
    // Re-check when the user comes back from the phone's settings screen.
    const onFocus = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onFocus);
    return () => document.removeEventListener('visibilitychange', onFocus);
  }, [refresh]);

  if (!push || push.reason === 'web') return null;
  const items = [
    { what: 'notifications', ok: push.permission !== false && push.ringChannel !== false, label: 'Notifications allowed, with sound', fix: 'Allow' },
    { what: 'battery', ok: push.batteryUnrestricted !== false, label: 'Battery: not restricted', fix: 'Allow' },
  ];
  if (push.autoStartScreen) items.push({ what: 'autostart', ok: null, label: 'Auto-launch / auto-start on', fix: 'Open' });

  return (
    <div className="mt">
      <p className="muted small"><b>To ring when the app is closed</b>, this phone needs:</p>
      <ul className="rank-list">
        {items.map((it) => (
          <li key={it.what}>
            <span className="grow"><strong>{it.ok === true ? '✓ ' : it.ok === false ? '✗ ' : ''}{it.label}</strong></span>
            {it.ok !== true && <button className="btn btn-ghost" onClick={() => openAlertSettings(it.what)}>{it.fix}</button>}
          </li>
        ))}
      </ul>
      <p className="muted small">
        {push.autoStartScreen
          ? 'Turn on auto-launch for KLG Delivery on the screen that opens. '
          : `On ${push.manufacturer || 'this phone'}: App info → Battery → allow background activity. `}
        Don&apos;t swipe the app away from recent apps; lock it there if your phone allows.
      </p>
    </div>
  );
}
