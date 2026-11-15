// Delivery / Self Order (Pickup) ON-OFF switches. `compact` = top bar version.
import useOrderModes, { setOrderMode } from '../../hooks/useOrderModes';
import { useUi } from '../../context/DataContext';

const MODES = [
  ['delivery', 'Delivery', 'Delivery Orders'],
  ['pickup', 'Pickup', 'Self Order (Pickup) Orders'],
];

export default function OrderModeSwitches({ compact = false }) {
  const { modes, error, busy } = useOrderModes();
  const { toast, confirm } = useUi();

  const flip = async (mode, label, on) => {
    if (!on && !(await confirm({
      title: `Turn ${label} OFF?`,
      message: `Customers can't place new ${label} until you turn it back on.`,
      confirmLabel: 'Turn OFF',
      danger: true,
    }))) return;
    const err = await setOrderMode(mode, on);
    if (err) toast(err, 'danger');
    else toast(`${label}: ${on ? 'ON' : 'OFF'}`, on ? 'success' : 'info');
  };

  if (compact) {
    if (!modes) return null; // nothing in the top bar until we know the state
    return (
      <div className="m-modes" role="group" aria-label="Ordering on / off">
        {MODES.map(([mode, short, label]) => (
          <label key={mode} className={`switch sm mode-pill ${modes[mode] ? 'is-on' : 'is-off'}`}>
            <input type="checkbox" checked={modes[mode]} disabled={!!busy} aria-label={label} onChange={(e) => flip(mode, label, e.target.checked)} />
            <span className="switch-track" />
            <span className="switch-text">{short} <b>{busy === mode ? '…' : modes[mode] ? 'ON' : 'OFF'}</b></span>
          </label>
        ))}
      </div>
    );
  }

  if (error && !modes) return <p className="muted small">{error}</p>;
  if (!modes) return <p className="muted small">Loading…</p>;
  return (
    <>
      {MODES.map(([mode, , label]) => (
        <label key={mode} className="switch row">
          <input type="checkbox" checked={modes[mode]} disabled={!!busy} aria-label={label} onChange={(e) => flip(mode, label, e.target.checked)} />
          <span className="switch-track" /><span className="switch-text">{label}: <b>{busy === mode ? '…' : modes[mode] ? 'ON' : 'OFF'}</b></span>
        </label>
      ))}
      <p className="muted small">Same switches as the top bar and the KLG admin website. Turning one off stops customers placing new orders of that type right away. Opening times are set on the website.</p>
    </>
  );
}
