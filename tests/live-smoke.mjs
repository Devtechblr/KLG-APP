// Live, READ-ONLY check against the real KLG backend. Never changes orders or drivers.
//   npm run test:live
// Optional credentials (PowerShell):  $env:KLG_ADMIN_EMAIL="..."; $env:KLG_ADMIN_PASSWORD="..."
//                                     $env:KLG_DRIVER_LOGIN="98xxxxxxxx"; $env:KLG_DRIVER_PASSWORD="..."
// Without credentials it checks health, the login error path and the device-token endpoint.
const BASE = (process.env.VITE_API_BASE_URL || 'https://us-central1-krishna-leela-grand.cloudfunctions.net/api').replace(/\/+$/, '');
let failed = 0;
let skipped = 0;

async function call(path, { method = 'GET', body, token } = {}) {
  // No Origin header, exactly like the Android app's native HTTP.
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, json };
}

async function check(name, fn) {
  try {
    const note = await fn();
    if (note === 'skip') { skipped++; console.log(`  -  ${name} (skipped: no credentials)`); return; }
    console.log(`  ✓  ${name}${note ? ` — ${note}` : ''}`);
  } catch (e) {
    failed++;
    console.log(`  ✗  ${name} — ${e.message}`);
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

console.log(`KLG live smoke test → ${BASE}\n`);

await check('backend is up (/health)', async () => {
  const r = await call('/health');
  assert(r.status === 200 && r.json?.status === 'OK', `HTTP ${r.status}`);
  return r.json.environment;
});

await check('wrong password is rejected with 401', async () => {
  const r = await call('/admin/login', { method: 'POST', body: { email: 'nobody@klg.invalid', password: 'x' } });
  assert(r.status === 401 && r.json?.success === false, `HTTP ${r.status} ${JSON.stringify(r.json)}`);
});

await check('app-style request (no Origin) passes CORS', async () => {
  const r = await call('/admin/login', { method: 'POST', body: { email: 'nobody@klg.invalid', password: 'x' } });
  assert(!/CORS/i.test(r.json?.message || ''), r.json?.message);
});

await check('push device-token endpoint is live', async () => {
  const r = await call('/public/device-tokens', { method: 'POST', body: { token: 'short' } });
  assert(r.status === 400 && /FCM token/i.test(r.json?.message || ''), `HTTP ${r.status}`);
});

const { KLG_ADMIN_EMAIL, KLG_ADMIN_PASSWORD, KLG_DRIVER_LOGIN, KLG_DRIVER_PASSWORD } = process.env;
let adminToken = null;
await check('admin sign-in', async () => {
  if (!KLG_ADMIN_EMAIL) return 'skip';
  const r = await call('/admin/login', { method: 'POST', body: { email: KLG_ADMIN_EMAIL, password: KLG_ADMIN_PASSWORD } });
  assert(r.status === 200 && r.json?.token, r.json?.message || `HTTP ${r.status}`);
  assert(['Super Admin', 'Admin', 'Delivery'].includes(r.json.admin.role), `role ${r.json.admin.role} cannot use the delivery app`);
  adminToken = r.json.token;
  return `role ${r.json.admin.role}`;
});
await check('admin: delivery orders load', async () => {
  if (!adminToken) return 'skip';
  const r = await call('/admin/orders?orderType=DELIVERY&limit=5&page=1', { token: adminToken });
  assert(r.status === 200 && Array.isArray(r.json?.data), r.json?.message || `HTTP ${r.status}`);
  return `${r.json.pagination?.total ?? r.json.data.length} delivery orders`;
});
await check('admin: drivers load', async () => {
  if (!adminToken) return 'skip';
  const r = await call('/admin/riders', { token: adminToken });
  assert(r.status === 200 && Array.isArray(r.json?.data), r.json?.message || `HTTP ${r.status}`);
  return `${r.json.data.length} drivers`;
});

let driverToken = null;
await check('driver sign-in', async () => {
  if (!KLG_DRIVER_LOGIN) return 'skip';
  const r = await call('/admin/login', { method: 'POST', body: { email: KLG_DRIVER_LOGIN, password: KLG_DRIVER_PASSWORD } });
  assert(r.status === 200 && r.json?.admin?.role === 'Driver', r.json?.message || `role ${r.json?.admin?.role}`);
  driverToken = r.json.token;
  return r.json.admin.name;
});
for (const path of ['/rider/profile', '/rider/orders/active', '/rider/orders/available', '/rider/orders/completed', '/rider/stats', '/rider/notifications']) {
  await check(`driver: ${path}`, async () => {
    if (!driverToken) return 'skip';
    const r = await call(path, { token: driverToken });
    assert(r.status === 200 && r.json?.success !== false, r.json?.message || `HTTP ${r.status}`);
  });
}

console.log(`\n${failed ? `${failed} FAILED` : 'All live checks passed'}${skipped ? ` (${skipped} skipped – set credentials to run them)` : ''}`);
process.exit(failed ? 1 : 0);
