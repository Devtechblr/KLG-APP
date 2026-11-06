// Bluetooth thermal printer (Android). The printer is paired once in Android's
// Bluetooth settings, then chosen in the app's Settings → Printer. Receipts are
// sent as raw ESC/POS bytes by the native KlgNative plugin (BluetoothPrinter.java).
// In a browser there is no Bluetooth access, so printing falls back to the
// browser's print dialog (utils/receipt.js).
import { Capacitor, registerPlugin } from '@capacitor/core';
import { api } from '../api/http';
import { receiptBytes, toBase64 } from '../../utils/escpos';
import { printReceipt as printInBrowser } from '../../utils/receipt';

const KlgNative = registerPlugin('KlgNative');
const PRINTER_KEY = 'klg.printer';
const PRINTED_KEY = 'klg.printedOrders';
const MAX_PRINTED = 300;

export const canUseBluetooth = () => Capacitor.isNativePlatform();

// ---- Chosen printer -------------------------------------------------------
// { address, name, autoPrint: boolean }
export function getPrinter() {
  try { return JSON.parse(localStorage.getItem(PRINTER_KEY)) || null; } catch { return null; }
}
export function setPrinter(p) {
  if (p) localStorage.setItem(PRINTER_KEY, JSON.stringify(p));
  else localStorage.removeItem(PRINTER_KEY);
  window.dispatchEvent(new Event('klg:printer'));
}
/** Auto-print runs only on the phone that has a printer chosen and auto-print on. */
export const autoPrintOn = () => { const p = getPrinter(); return !!(p?.address && p.autoPrint !== false); };

export async function listPrinters() {
  if (!canUseBluetooth()) throw new Error('Bluetooth printing works in the Android app.');
  const { devices = [] } = await KlgNative.printerList();
  // Printers first.
  return devices.sort((a, b) => Number(!!b.printer) - Number(!!a.printer) || a.name.localeCompare(b.name));
}

// ---- Receipt layout settings (paper width, restaurant name …) from the website
let settings = null;
let settingsAt = 0;
async function printSettings() {
  if (settings && Date.now() - settingsAt < 10 * 60_000) return settings;
  try {
    const { data = {} } = await api('/public/print-settings', { auth: false, timeoutMs: 8000 });
    settings = {
      paperWidth: String(data.paperWidth) === '80' ? 80 : 58,
      restaurant: { name: data.restaurantName, tagline: data.restaurantTagline, address: data.restaurantAddress, phone: data.restaurantPhone, gstNumber: data.gstNumber },
    };
    settingsAt = Date.now();
  } catch {
    if (!settings) return { paperWidth: 58, restaurant: {} };
  }
  return settings;
}

// ---- Printing ---------------------------------------------------------------
async function sendToPrinter(bytes, printer = getPrinter()) {
  if (!printer?.address) throw new Error('No printer chosen. Open Settings → Printer.');
  await KlgNative.printerPrint({ address: printer.address, data: toBase64(bytes) });
}

/**
 * Prints one receipt. Returns 'bluetooth' or 'browser'.
 * Throws with a readable message if the Bluetooth printer can't be reached.
 */
export async function printOrder(order, customer, driver) {
  if (!canUseBluetooth() || !getPrinter()?.address) {
    printInBrowser(order, customer, driver);
    return 'browser';
  }
  const opts = await printSettings();
  await sendToPrinter(receiptBytes(order, customer, opts));
  markPrinted(order.id);
  return 'bluetooth';
}

export async function testPrint(printer) {
  const sample = {
    id: 'TEST-PRINT', createdAt: new Date().toISOString(), subtotal: 100, gst: 5, packing: 10, deliveryCharge: 0, total: 115,
    paymentMethod: 'ONLINE', paymentStatus: 'PAID', notes: 'Printer test from KLG Delivery',
    items: [{ name: 'Masala Dosa', qty: 1, price: 60 }, { name: 'Filter Coffee', qty: 1, price: 40 }],
  };
  const opts = await printSettings();
  await sendToPrinter(receiptBytes(sample, { name: 'Test', phone: '', address: '' }, opts), printer);
}

// ---- Printed log: an order auto-prints once per phone --------------------------
function readPrinted() {
  try { return new Map(JSON.parse(localStorage.getItem(PRINTED_KEY)) || []); } catch { return new Map(); }
}
export const wasPrinted = (orderId) => readPrinted().has(String(orderId));
export function markPrinted(orderId) {
  const m = readPrinted();
  m.set(String(orderId), Date.now());
  const entries = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_PRINTED);
  try { localStorage.setItem(PRINTED_KEY, JSON.stringify(entries)); } catch { /* storage full */ }
}
