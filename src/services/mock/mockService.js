// In-browser demo store. Never performs network requests.
import { buildSeed } from './seed';

const KEY = 'klg-mobile-demo-v1';
const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  const seed = buildSeed();
  write(seed);
  return seed;
}
function write(db) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* quota */ }
}

export const mockService = {
  mode: 'mock',
  async loadAll() { await delay(); return structuredClone(read()); },
  async save(db) { write(db); return true; },
  async reset() { localStorage.removeItem(KEY); await delay(200); return structuredClone(read()); },
};
