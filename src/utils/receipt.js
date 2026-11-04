import { fmtDateTime, inr2 } from './format';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Prints a thermal-style receipt through a hidden iframe (no popups, no network).
export function printReceipt(order, customer, driver) {
  const rows = order.items
    .map((i) => `<tr><td>${esc(i.name)} x ${i.qty}</td><td class="r">${inr2(i.qty * i.price)}</td></tr>`)
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(order.id)}</title>
  <style>
    body{font-family:monospace;width:72mm;margin:0 auto;padding:8px;color:#000;font-size:12px}
    h2{text-align:center;margin:4px 0;font-size:15px} p{margin:2px 0} .c{text-align:center}
    table{width:100%;border-collapse:collapse} td{padding:2px 0;vertical-align:top} .r{text-align:right}
    hr{border:0;border-top:1px dashed #000;margin:6px 0} .t td{font-weight:bold;font-size:14px}
  </style></head><body>
  <h2>Krishna Leela Grand</h2><p class="c">Pure Vegetarian Restaurant</p><hr>
  <p><b>${esc(order.id)}</b></p><p>${fmtDateTime(order.createdAt)}</p><hr>
  <p><b>${esc(customer?.name)}</b> · ${esc(customer?.phone)}</p><p>${esc(customer?.address)}</p><hr>
  <table>${rows}<tr><td>Packing</td><td class="r">${inr2(order.packing)}</td></tr></table><hr>
  <table class="t"><tr><td>TOTAL</td><td class="r">${inr2(order.total)}</td></tr></table>
  <p>${order.paymentMethod === 'ONLINE' ? 'Online' : 'Cash on Delivery'} · ${esc(order.paymentStatus)}</p>
  ${driver ? `<p>Driver: ${esc(driver.name)}</p>` : ''}
  ${order.notes ? `<p>Note: ${esc(order.notes)}</p>` : ''}
  <hr><p class="c">Thank you! Visit again.</p></body></html>`;

  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  frame.contentDocument.open();
  frame.contentDocument.write(html);
  frame.contentDocument.close();
  setTimeout(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 1000);
  }, 150);
}
