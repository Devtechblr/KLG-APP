// Deterministic demo data for Krishna Leela Grand.
// Everything here is fictional. Phone numbers use the 98765 0xxxx / 90000 xxxxx
// style ranges and are not real customers. Dates are generated relative to "today"
// so the demo always looks current.

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const MENU = [
  { id: 'm1', name: 'Vada (1)', category: 'Breakfast', price: 50, emoji: '🍩' },
  { id: 'm2', name: 'Rava Idly', category: 'Breakfast', price: 60, emoji: '🍚' },
  { id: 'm3', name: 'Idly (2)', category: 'Breakfast', price: 45, emoji: '🍚' },
  { id: 'm4', name: 'Masala Dosa', category: 'Dosa', price: 90, emoji: '🥞' },
  { id: 'm5', name: 'Plain Dosa', category: 'Dosa', price: 70, emoji: '🥞' },
  { id: 'm6', name: 'Onion Rava Dosa', category: 'Dosa', price: 105, emoji: '🥞' },
  { id: 'm7', name: 'Set Dosa', category: 'Dosa', price: 85, emoji: '🥞' },
  { id: 'm8', name: 'South Indian Meals', category: 'Meals', price: 160, emoji: '🍛' },
  { id: 'm9', name: 'Mini Meals', category: 'Meals', price: 120, emoji: '🍛' },
  { id: 'm10', name: 'Curd Rice', category: 'Meals', price: 80, emoji: '🍚' },
  { id: 'm11', name: 'Kesari Bath', category: 'Sweets', price: 55, emoji: '🍮' },
  { id: 'm12', name: 'Jaggery Coffee', category: 'Beverages', price: 40, emoji: '☕' },
  { id: 'm13', name: 'Filter Coffee', category: 'Beverages', price: 35, emoji: '☕' },
  { id: 'm14', name: 'Masala Tea', category: 'Beverages', price: 30, emoji: '🍵' },
  { id: 'm15', name: 'Water Bottle 1 liter', category: 'Beverages', price: 20, emoji: '💧' },
  { id: 'm16', name: 'Poori Sagu', category: 'Breakfast', price: 75, emoji: '🫓' },
];

const CUSTOMER_NAMES = [
  'Ananya Rao', 'Rohit Sharma', 'Priya Nair', 'Karthik Reddy', 'Sneha Kulkarni',
  'Vikram Iyer', 'Meera Hegde', 'Arjun Menon', 'Divya Shetty', 'Suresh Gowda',
  'Lakshmi Prasad', 'Aditya Joshi', 'Pooja Bhat', 'Rahul Verma', 'Kavya Murthy',
  'Naveen Kumar', 'Shalini Pai', 'Harish Rangan', 'Deepa Srinivas', 'Manoj Patil',
  'Swathi Acharya', 'Ganesh Rao', 'Nisha Kamath', 'Sanjay Desai',
];

const AREAS = [
  ['12, 2nd Cross, Jayanagar 4th Block', 'Jayanagar'],
  ['45, 8th Main, BTM Layout 2nd Stage', 'BTM Layout'],
  ['Flat 302, Sai Residency, HSR Layout Sector 2', 'HSR Layout'],
  ['78, 1st Main, Basavanagudi', 'Basavanagudi'],
  ['21, 5th Cross, JP Nagar 6th Phase', 'JP Nagar'],
  ['B-104, Brigade Apartments, Banashankari 2nd Stage', 'Banashankari'],
  ['9, 3rd Main, Wilson Garden', 'Wilson Garden'],
  ['56, 11th Cross, Koramangala 6th Block', 'Koramangala'],
  ['33, 4th Main, Kumaraswamy Layout', 'Kumaraswamy Layout'],
  ['17, 7th Cross, Malleshwaram', 'Malleshwaram'],
  ['Flat 5B, Prestige Lakeside, Bellandur', 'Bellandur'],
  ['64, 2nd Main, Vijayanagar', 'Vijayanagar'],
];

export const DRIVERS_SEED = [
  { id: 'd1', name: 'Ramesh Kumar', phone: '9000012301', vehicle: 'Bike', vehicleNo: 'KA-05-HK-4412', online: true, joinedAt: '2025-03-14', rating: 4.8 },
  { id: 'd2', name: 'Manjunath S', phone: '9000012302', vehicle: 'Scooter', vehicleNo: 'KA-01-EJ-2290', online: true, joinedAt: '2025-06-02', rating: 4.6 },
  { id: 'd3', name: 'Imran Pasha', phone: '9000012303', vehicle: 'Bike', vehicleNo: 'KA-51-AB-7781', online: true, joinedAt: '2025-01-20', rating: 4.9 },
  { id: 'd4', name: 'Venkatesh B', phone: '9000012304', vehicle: 'Scooter', vehicleNo: 'KA-02-MN-1150', online: false, joinedAt: '2025-09-11', rating: 4.4 },
  { id: 'd5', name: 'Prakash Naik', phone: '9000012305', vehicle: 'Bike', vehicleNo: 'KA-03-PL-6623', online: true, joinedAt: '2026-02-08', rating: 4.7 },
  { id: 'd6', name: 'Santosh Hiremath', phone: '9000012306', vehicle: 'E-Bike', vehicleNo: 'KA-05-EV-0091', online: false, joinedAt: '2026-05-19', rating: 4.5 },
];

const DAY_MS = 86400000;
const pad = (n, l = 2) => String(n).padStart(l, '0');
const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

export function buildSeed(now = new Date()) {
  const rand = mulberry32(20261101);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const between = (a, b) => a + Math.floor(rand() * (b - a + 1));

  const customers = CUSTOMER_NAMES.map((name, i) => {
    const [address, area] = AREAS[i % AREAS.length];
    return {
      id: `c${i + 1}`,
      name,
      phone: `98765${pad(10000 + i * 137, 5).slice(-5)}`,
      address: `${address}, ${area}, Bengaluru, Karnataka 5600${pad(between(10, 99))}`,
      area,
      joinedAt: new Date(now.getTime() - between(40, 400) * DAY_MS).toISOString(),
    };
  });

  const drivers = DRIVERS_SEED.map((d) => ({ ...d }));
  const orders = [];
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const DAYS = 75;

  for (let dayOffset = DAYS - 1; dayOffset >= 0; dayOffset--) {
    const day = new Date(startOfToday.getTime() - dayOffset * DAY_MS);
    // Fewer orders in the distant past, more recently.
    let count = dayOffset > 30 ? between(3, 6) : between(6, 11);
    if (dayOffset === 0) count = 14;
    const used = new Set();
    const times = [];
    for (let k = 0; k < count; k++) {
      // 7:00 to 22:30, but for today only up to current time
      const maxMinute = dayOffset === 0 ? Math.max(7 * 60 + 30, now.getHours() * 60 + now.getMinutes() - 5) : 22 * 60 + 30;
      times.push(between(7 * 60, Math.min(maxMinute, 22 * 60 + 30)));
    }
    times.sort((a, b) => a - b);

    times.forEach((minute, k) => {
      let seq;
      do seq = between(10, 999); while (used.has(seq));
      used.add(seq);
      const createdAt = new Date(day.getTime() + minute * 60000);
      const customer = pick(customers);
      const itemCount = between(1, 4);
      const chosen = new Set();
      const items = [];
      for (let j = 0; j < itemCount; j++) {
        const m = pick(MENU);
        if (chosen.has(m.id)) continue;
        chosen.add(m.id);
        items.push({ menuId: m.id, name: m.name, qty: between(1, 3), price: m.price });
      }
      const subtotal = items.reduce((s, it) => s + it.qty * it.price, 0);
      const packing = items.length * 2.5;
      const total = Math.round((subtotal + packing) * 100) / 100;
      const paymentMethod = rand() < 0.78 ? 'ONLINE' : 'COD';

      // Status depends on age: older orders are finished.
      let status;
      const r = rand();
      const isRecentToday = dayOffset === 0 && k >= count - 10;
      if (isRecentToday) {
        const live = ['PENDING', 'PENDING', 'ACCEPTED', 'PREPARING', 'PREPARING', 'READY', 'ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'];
        status = live[(k - (count - 10)) % live.length];
      } else {
        status = r < 0.12 ? 'CANCELLED' : 'DELIVERED';
      }

      const needsDriver = ['ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(status);
      const onlineDrivers = drivers.filter((d) => d.online);
      const driverPool = dayOffset === 0 ? onlineDrivers : drivers.filter((d) => new Date(d.joinedAt) <= day);
      const driver = needsDriver ? pick(driverPool.length ? driverPool : drivers) : null;
      const distanceKm = Math.round((1.2 + rand() * 6.5) * 10) / 10;

      const paymentStatus =
        status === 'CANCELLED'
          ? paymentMethod === 'ONLINE' ? 'REFUNDED' : 'UNPAID'
          : paymentMethod === 'ONLINE' ? 'PAID' : status === 'DELIVERED' ? 'PAID' : 'UNPAID';

      orders.push({
        id: `KLG-${ymd(day)}-${seq}`,
        createdAt: createdAt.toISOString(),
        customerId: customer.id,
        items,
        subtotal,
        packing,
        total,
        paymentMethod,
        paymentStatus,
        status,
        driverId: driver ? driver.id : null,
        distanceKm,
        notes: rand() < 0.15 ? pick(['Less spicy please', 'Ring the bell twice', 'Extra chutney', 'Call on arrival']) : '',
        timeline: buildTimeline(status, createdAt, driver, rand),
      });
    });
  }

  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const menu = MENU.map((m, i) => ({ ...m, available: i !== 6 && i !== 10 }));
  const adminUsers = [
    { id: 'u1', name: 'Restaurant Admin', email: 'admin@example.com', role: 'Admin' },
    { id: 'u2', name: 'Front Desk', email: 'frontdesk@example.com', role: 'Delivery Manager' },
  ];
  return { customers, drivers, orders, menu, adminUsers };
}

export const FLOW = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'];

function buildTimeline(status, createdAt, driver, rand) {
  const t = [];
  let at = createdAt.getTime();
  const end = status === 'CANCELLED' ? 2 : FLOW.indexOf(status) + 1;
  const steps = status === 'CANCELLED' ? FLOW.slice(0, 1) : FLOW.slice(0, end);
  steps.forEach((s, i) => {
    if (i > 0) at += (3 + Math.floor(rand() * 10)) * 60000;
    t.push({ status: s, at: new Date(at).toISOString(), note: s === 'ASSIGNED' && driver ? `Assigned to ${driver.name}` : '' });
  });
  if (status === 'CANCELLED') t.push({ status: 'CANCELLED', at: new Date(at + 4 * 60000).toISOString(), note: 'Cancelled by restaurant' });
  return t;
}
