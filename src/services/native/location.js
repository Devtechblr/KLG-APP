// Driver live location while an order is out for delivery.
// Android: a native foreground service keeps posting GPS even with the screen off
// (LocationService.java). Web / fallback: navigator.geolocation while the page is open.
// The customer's tracking page on order.krishnaleelagrand.com shows it on a live map.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { API_BASE_URL } from '../../config';

const KlgNative = registerPlugin('KlgNative');

function token() {
  try { return JSON.parse(localStorage.getItem('klg.session'))?.token || null; } catch { return null; }
}

/** Returns { tracking: boolean, reason?: string, native: boolean }. */
export async function startLiveLocation(orderId) {
  if (!Capacitor.isNativePlatform()) return { tracking: false, native: false };
  try {
    const res = await KlgNative.startTracking({
      orderId,
      token: token(),
      endpoint: `${API_BASE_URL}/rider/orders/${encodeURIComponent(orderId)}/location`,
    });
    return { ...res, native: true };
  } catch (e) {
    return { tracking: false, reason: e.message, native: false };
  }
}

export async function stopLiveLocation() {
  if (!Capacitor.isNativePlatform()) return;
  try { await KlgNative.stopTracking(); } catch { /* ignore */ }
}
