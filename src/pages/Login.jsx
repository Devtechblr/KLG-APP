import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { FlaskConical, LogIn, ShieldCheck, Bike, AlertCircle, Eye, EyeOff } from 'lucide-react';
import BrandMark from '../components/mobile/BrandMark';
import { ADMIN_ROLES, USE_MOCK_DATA } from '../config';
import { signIn } from '../services/api/apiService';
import { useData } from '../context/DataContext';
import { useSession } from '../context/SessionContext';

const HOME = { admin: '/admin/delivery-orders', driver: '/driver/active' };

export default function Login() {
  const navigate = useNavigate();
  const { db } = useData();
  const { session, login, notice } = useSession();
  const [role, setRole] = useState('admin');
  const [driverId, setDriverId] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  if (session) return <Navigate to={HOME[session.role]} replace />;

  const enterDemo = () => {
    if (role === 'admin') {
      login({ role: 'admin', name: 'Admin', adminRole: 'Admin' });
    } else {
      const driver = db?.drivers?.find((d) => d.id === driverId);
      login({ role: 'driver', driverId, name: driver?.name || 'Driver' });
    }
    navigate(HOME[role], { replace: true });
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAuthError('');
    try {
      const s = await signIn(identifier, password);
      if (s.role === 'admin' && !ADMIN_ROLES.includes(s.adminRole)) {
        throw new Error(`The "${s.adminRole}" role can't use the delivery app.`);
      }
      login(s);
      navigate(HOME[s.role], { replace: true });
    } catch (err) {
      setAuthError(err.status === 401 ? 'Wrong email/phone or password.' : err.message || 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="card login-card">
        <BrandMark size={64} />
        <h1>Krishna Leela Grand</h1>
        <p className="muted">Delivery App</p>

        {(authError || notice) && (
          <div className="login-error" role="alert">
            <AlertCircle size={16} /> <span>{authError || notice}</span>
          </div>
        )}

        {USE_MOCK_DATA ? (
          <>
            <div className="role-pick" role="radiogroup" aria-label="Sign in as">
              <button type="button" role="radio" aria-checked={role === 'admin'} className={`role-opt ${role === 'admin' ? 'is-active' : ''}`} onClick={() => setRole('admin')}>
                <ShieldCheck size={22} /><strong>Admin</strong><small>Manage deliveries & drivers</small>
              </button>
              <button type="button" role="radio" aria-checked={role === 'driver'} className={`role-opt ${role === 'driver' ? 'is-active' : ''}`} onClick={() => setRole('driver')}>
                <Bike size={22} /><strong>Driver</strong><small>My assigned deliveries</small>
              </button>
            </div>
            {role === 'driver' && (
              <label className="field login-field">
                <span>Which driver are you?</span>
                <select className="select" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
                  <option value="">Select your name</option>
                  {db?.drivers?.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.vehicleNo}</option>)}
                </select>
              </label>
            )}
            <p className="login-note"><FlaskConical size={14} /> Demo mode. No real account is used.</p>
            <button className="btn btn-primary btn-block" disabled={role === 'driver' && !driverId} onClick={enterDemo}>
              <LogIn size={18} /> Continue as {role === 'admin' ? 'Admin' : 'Driver'}
            </button>
          </>
        ) : (
          <form onSubmit={submit} className="login-form">
            <label className="field login-field">
              <span>Email or mobile number</span>
              <input
                className="input"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                inputMode="email"
                placeholder="admin email, or driver's 10-digit number"
                required
              />
            </label>
            <label className="field login-field">
              <span>Password</span>
              <div className="pw-wrap">
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button type="button" className="pw-toggle" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading || !identifier.trim() || !password}>
              <LogIn size={18} /> {loading ? 'Signing in…' : 'Sign in'}
            </button>
            <p className="login-note">Admins and drivers use the same accounts as the KLG website.</p>
          </form>
        )}
      </div>
    </div>
  );
}
