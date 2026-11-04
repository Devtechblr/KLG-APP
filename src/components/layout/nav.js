import { Truck, Bike, Settings, Gauge } from 'lucide-react';

// Admin side of the delivery app: delivery management only.
export const PRIMARY_NAV = [
  { to: '/admin/delivery-orders', label: 'Deliveries', icon: Truck, badge: 'activeDeliveries' },
  { to: '/admin/drivers', label: 'Drivers', icon: Bike },
  { to: '/admin/driver-performance', label: 'Performance', icon: Gauge },
];

export const MORE_NAV = [
  { to: '/admin/settings', label: 'Settings', icon: Settings, desc: 'Notifications, users, demo data' },
];

export const DESKTOP_NAV = [...PRIMARY_NAV, ...MORE_NAV];
