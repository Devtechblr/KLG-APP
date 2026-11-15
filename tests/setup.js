import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { resetOrderModes } from '../src/hooks/useOrderModes';

// jsdom gaps used by the app.
if (!globalThis.structuredClone) globalThis.structuredClone = (v) => JSON.parse(JSON.stringify(v));
window.scrollTo = () => {};
if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};
window.open = vi.fn();

afterEach(() => {
  cleanup();
  localStorage.clear();
  resetOrderModes();
  document.documentElement.classList.remove('with-modes');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
