import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import DriverLayout from './components/layout/DriverLayout';
import Deliveries from './pages/Deliveries';
import DeliveryDetails from './pages/DeliveryDetails';
import Drivers from './pages/Drivers';
import DriverPerformance from './pages/DriverPerformance';
import Settings from './pages/Settings';
import Login from './pages/Login';
import DriverActive from './pages/driver/DriverActive';
import DriverHistory from './pages/driver/DriverHistory';
import DriverProfile from './pages/driver/DriverProfile';
import DriverOrder from './pages/driver/DriverOrder';
import { useSession } from './context/SessionContext';

const HOME = { admin: '/admin/delivery-orders', driver: '/driver/active' };

function RequireRole({ role, children }) {
  const { session } = useSession();
  if (!session) return <Navigate to="/login" replace />;
  if (session.role !== role) return <Navigate to={HOME[session.role]} replace />;
  return children;
}

function Home() {
  const { session } = useSession();
  return <Navigate to={session ? HOME[session.role] : '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/admin/login" element={<Navigate to="/login" replace />} />

      <Route path="/admin" element={<RequireRole role="admin"><AppLayout /></RequireRole>}>
        <Route index element={<Navigate to="delivery-orders" replace />} />
        <Route path="delivery-orders" element={<Deliveries />} />
        <Route path="delivery-orders/:id" element={<DeliveryDetails />} />
        <Route path="drivers" element={<Drivers />} />
        <Route path="driver-performance" element={<DriverPerformance />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="/driver" element={<RequireRole role="driver"><DriverLayout /></RequireRole>}>
        <Route index element={<Navigate to="active" replace />} />
        <Route path="active" element={<DriverActive />} />
        <Route path="order/:id" element={<DriverOrder />} />
        <Route path="history" element={<DriverHistory />} />
        <Route path="profile" element={<DriverProfile />} />
      </Route>

      <Route path="*" element={<Home />} />
    </Routes>
  );
}
