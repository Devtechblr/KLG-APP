// ESC/POS thermal receipt, laid out like the KLG website's printed receipt
// (klg/admin/src/utils/printHelper.js + frontend/src/utils/receiptModel.js),
// plus the delivery address so the parcel slip can travel with the order.

export const RESTAURANT = {
  name: 'Krishna Leela Grand',
  tagline: 'Pure Vegetarian Restaurant',
  address: '#191, Niranthara Layout, Bagalur Main Road, Kattigenahalli, Near Reva University, Yelahanka, Bengaluru, Karnataka - 560064',
  phone: '+91 91876 39609, +91 99805 43239',
  email: 'krishnaleelagrandreva@gmail.com',
  gstNumber: '29ABCDE1234F1Z5',
};

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;
const CMD = {
  init: [ESC, 0x40],
  left: [ESC, 0x61, 0x00],
  center: [ESC, 0x61, 0x01],
  boldOn: [ESC, 0x45, 0x01],
  boldOff: [ESC, 0x45, 0x00],
  big: [ESC, 0x21, 0x18], // double height + bold
  normal: [ESC, 0x21, 0x00],
  feed4: [ESC, 0x64, 0x04],
  cut: [GS, 0x56, 0x00],
};

const layout = (lineWidth, qty, rate, amt) => ({ lineWidth, qty, rate, amt, name: lineWidth - qty - rate - amt });
export const LAYOUTS = { 58: layout(32, 4, 8, 9), 80: layout(48, 4, 10, 11) };

const money = (v) => (Number(v) || 0).toFixed(2);
// Thermal printers only know plain ASCII here; drop accents/emoji instead of printing garbage.
const ascii = (s) => String(s ?? '').normalize('NFKD').replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim();

export function wrap(text, width) {
  const lines = [];
  let cur = '';
  for (const word of ascii(text).split(' ').filter(Boolean)) {
    let rest = word;
    while (rest.length > width) {
      if (cur) { lines.push(cur); cur = ''; }
      lines.push(rest.slice(0, width));
      rest = rest.slice(width);
    }
    if (!cur) cur = rest;
    else if (cur.length + 1 + rest.length <= width) cur += ` ${rest}`;
    else { lines.push(cur); cur = rest; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

const spread = (L, left, right) => left + ' '.repeat(Math.max(L.lineWidth - left.length - right.length, 1)) + right;

function itemRows(L, qty, name, rate, amount) {
  return wrap(name, L.name).map((n, i) => (i === 0
    ? qty.padEnd(L.qty) + n.padEnd(L.name) + rate.padStart(L.rate) + amount.padStart(L.amt)
    : ' '.repeat(L.qty) + n));
}

/**
 * Receipt as plain text lines (also used by tests and the browser fallback).
 * Each line: { text, align: 'left'|'center', bold, big }.
 */
export function receiptLines(order, customer, { paperWidth = 58, restaurant = {} } = {}) {
  const L = LAYOUTS[paperWidth] || LAYOUTS[58];
  const r = { ...RESTAURANT, ...Object.fromEntries(Object.entries(restaurant).filter(([, v]) => v)) };
  const out = [];
  let align = 'center';
  const push = (text, o = {}) => out.push({ text, align, bold: !!o.bold, big: !!o.big });
  const wrapped = (text, o) => wrap(text, L.lineWidth).forEach((t) => push(t, o));
  const rule = (c = '-') => push(c.repeat(L.lineWidth));

  const when = new Date(order.createdAt || Date.now());
  const gst = Number(order.gst) || 0;
  const cgst = Number((gst / 2).toFixed(2));
  const sgst = Number((gst - cgst).toFixed(2));
  const packing = Number(order.packing) || 0;
  const delivery = Number(order.deliveryCharge) || 0;

  wrapped(r.name.toUpperCase(), { bold: true, big: true });
  wrapped(r.tagline, { bold: true });
  wrapped(r.address);
  const contact = `${r.phone} | ${r.email}`;
  if (contact.length <= L.lineWidth) push(contact); else { wrapped(r.phone); wrapped(r.email); }
  rule();
  push('TAX INVOICE', { bold: true });
  wrapped(`GST Number: ${r.gstNumber}`);
  rule();

  align = 'left';
  push(spread(L, 'DELIVERY', ascii(order.id)), { bold: true });
  wrapped(`Date: ${when.toLocaleDateString('en-GB')} | Time: ${when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`);
  wrapped(`Customer: ${customer?.name || 'Customer'}`);
  if (customer?.phone) wrapped(`Phone: ${customer.phone}`);
  if (customer?.address) wrapped(`Address: ${customer.address}`);
  if (order.notes) wrapped(`Note: ${order.notes}`, { bold: true });
  wrapped(`Invoice Number: ${order.id}`);
  rule();

  itemRows(L, 'QTY', 'ITEM', 'RATE', 'AMT').forEach((t) => push(t, { bold: true }));
  rule();
  order.items.forEach((i) => itemRows(L, String(i.qty), i.name, money(i.price), money(i.price * i.qty)).forEach((t) => push(t)));
  rule();

  push(spread(L, 'Sub.Total', money(order.subtotal || order.items.reduce((s, i) => s + i.price * i.qty, 0))), { bold: true });
  push('Taxes/Charges', { bold: true });
  push(spread(L, 'CGST @ 2.5%', money(cgst)));
  push(spread(L, 'SGST @ 2.5%', money(sgst)));
  push(spread(L, 'Parcel Charge', money(packing)));
  if (delivery > 0) push(spread(L, 'Delivery Charge', money(delivery)));
  rule();
  push(spread(L, 'Total Charges/Taxes', money(gst + packing + delivery)), { bold: true });
  rule('=');
  push(spread(L, 'GRAND TOTAL', money(order.total)), { bold: true, big: true });
  push(spread(L, 'NET PAYABLE', `INR ${money(order.total)}`), { bold: true });
  rule();
  const cod = order.paymentMethod === 'COD' && order.paymentStatus !== 'PAID';
  wrapped(`Payment Type: ${cod ? 'Cash on Delivery - COLLECT CASH' : 'Online Paid'}`, { bold: cod });
  push('Invoice Currency: INR');
  rule();
  align = 'center';
  push('Thank You', { bold: true });
  push('');
  return out;
}

/** Raw ESC/POS bytes for a receipt. */
export function receiptBytes(order, customer, opts) {
  const bytes = [...CMD.init];
  let align = null;
  let style = null;
  for (const l of receiptLines(order, customer, opts)) {
    if (l.align !== align) { bytes.push(...(l.align === 'center' ? CMD.center : CMD.left)); align = l.align; }
    const want = l.big ? 'big' : l.bold ? 'bold' : 'normal';
    if (want !== style) {
      bytes.push(...CMD.normal, ...CMD.boldOff);
      if (want === 'big') bytes.push(...CMD.big);
      if (want === 'bold') bytes.push(...CMD.boldOn);
      style = want;
    }
    for (let i = 0; i < l.text.length; i++) bytes.push(l.text.charCodeAt(i) & 0x7f);
    bytes.push(LF);
  }
  bytes.push(...CMD.normal, ...CMD.boldOff, ...CMD.feed4, ...CMD.cut);
  return bytes;
}

export function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 4096) s += String.fromCharCode(...bytes.slice(i, i + 4096));
  return btoa(s);
}
