import { describe, expect, test } from 'vitest';
import { splitAddress, navHref } from '../src/utils/format';
import { friendlyError, printerError, alertsError } from '../src/utils/errors';

describe('splitAddress', () => {
  test('pulls the Google Maps link out of the address', () => {
    const r = splitAddress('Bellahalli Main Road, Kogilu, Karnataka, (Google Maps Link: https://maps.google.com/?q=13.1,77.6), Bengaluru, 560064');
    expect(r.address).toBe('Bellahalli Main Road, Kogilu, Karnataka, Bengaluru, 560064');
    expect(r.mapsUrl).toBe('https://maps.google.com/?q=13.1,77.6');
  });
  test('handles a bare link and plain addresses', () => {
    expect(splitAddress('Kogilu https://maps.app.goo.gl/abc123').address).toBe('Kogilu');
    expect(splitAddress('MG Road, Bengaluru')).toEqual({ address: 'MG Road, Bengaluru', mapsUrl: null });
  });
  test('Navigate prefers the customer pin', () => {
    expect(navHref({ mapsUrl: 'https://maps.app.goo.gl/x', address: 'a' })).toBe('https://maps.app.goo.gl/x');
    expect(navHref({ lat: 1, lng: 2, address: 'a' })).toContain('query=1%2C2');
  });
});

describe('friendlyError', () => {
  test('hides database errors', () => {
    const msg = friendlyError('E11000 duplicate key error collection: klg-prod.riders index: email_1 dup key: { email: "" }', 500);
    expect(msg).not.toMatch(/E11000|klg-prod/);
    expect(friendlyError('E11000 duplicate key ... phone_1', 500)).toBe('A driver with this phone number already exists.');
    expect(friendlyError('Cast to ObjectId failed for value "x"', 500)).toMatch(/^Something went wrong/);
    expect(friendlyError('Internal server error', 500)).toBe('Something went wrong on the server. Please try again.');
    expect(friendlyError(new TypeError("Cannot read properties of undefined (reading 'name')"))).toBe('Something went wrong. Please try again.');
    expect(friendlyError('Failed to fetch')).toMatch(/No internet/);
    expect(friendlyError('adminusers.findOne() buffering timed out after 10000ms', 500)).toMatch(/server is slow/);
    expect(friendlyError('{"code":11000}', 500)).not.toMatch(/11000/);
  });
  test('keeps normal messages', () => {
    expect(friendlyError('Phone number must be exactly 10 digits.', 400)).toBe('Phone number must be exactly 10 digits.');
  });
});

describe('printer and alert errors', () => {
  test('java errors become plain text', () => {
    expect(printerError(new Error('java.io.IOException: read failed, socket might closed or timeout, read ret: -1'))).toMatch(/Could not reach the printer/);
    expect(printerError(new Error('No printer chosen. Open Settings → Printer.'))).toBe('No printer chosen. Open Settings → Printer.');
  });
  test('alert setup reasons', () => {
    expect(alertsError('Firebase is not configured in this build (google-services.json missing)')).toBe('Could not turn on alerts. Please try again.');
    expect(alertsError('Server did not accept the device (HTTP 500)')).toMatch(/Could not reach the server/);
    expect(alertsError('permission')).toMatch(/blocked/);
  });
});
