// One place that turns any error (server, database, network, Android, JavaScript) into a short
// sentence staff can act on. Raw text like "E11000 duplicate key ...", "Cast to ObjectId",
// "java.io.IOException" or "Cannot read properties of undefined" is never shown in the app.

const GENERIC = 'Something went wrong. Please try again.';

// Looks like code/database/system output rather than a sentence written for people.
const TECHNICAL = new RegExp([
  'E11000', 'duplicate key', 'Mongo', 'mongoose', 'buffering timed out', 'Cast to', 'ObjectId', 'ValidationError',
  'validation failed', 'TypeError', 'ReferenceError', 'SyntaxError', 'RangeError', 'Cannot read prop',
  'is not defined', 'is not a function', 'undefined', 'null', 'NaN', 'Unexpected token', 'JSON',
  'Exception', 'java\\.', 'android\\.', 'kotlin', 'stack', '\\bat \\w+ \\(', 'ECONN', 'ETIMEDOUT', 'ENOTFOUND',
  'EAI_AGAIN', 'socket', 'HTTP \\d{3}', 'status code', 'Request failed \\(', 'Internal server error',
  'Firebase', 'FCM', 'google-services', 'token', 'jwt', 'collection:', 'index:', '[{}<>\\[\\]]', 'https?://',
].join('|'), 'i');

const isNetwork = (m) => /Failed to fetch|NetworkError|Network request failed|Load failed|No connection|ERR_INTERNET|ERR_NAME|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|offline/i.test(m);

function messageOf(e) {
  if (e == null) return '';
  if (typeof e === 'string') return e;
  return String(e.message || e.error || e.reason || '');
}

export function friendlyError(e, status = e?.status) {
  const m = messageOf(e).trim();

  if (/E11000|duplicate key/i.test(m)) {
    if (/email/i.test(m)) return /email:\s*(""|null)/i.test(m) ? 'Please enter an email for this driver.' : 'A driver with this email already exists.';
    if (/phone/i.test(m)) return 'A driver with this phone number already exists.';
    return 'This already exists.';
  }
  if (isNetwork(m) || status === 0 && !m) return 'No internet connection. Check your network and try again.';
  if (/took too long|timed? ?out|buffering timed out|MongoNetwork|server selection/i.test(m)) return 'The server is slow right now. Please try again in a moment.';
  if (status === 401) return 'Your session has ended. Please sign in again.';
  if (status === 429) return 'Too many tries. Please wait a minute and try again.';

  if (!m || TECHNICAL.test(m) || m.length > 160) {
    if (status === 403) return 'You are not allowed to do this.';
    if (status === 404) return 'Not found. It may have been removed or changed.';
    if (status >= 500) return 'Something went wrong on the server. Please try again.';
    return GENERIC;
  }
  return m;
}

// Bluetooth printer (Android plugin errors are Java exception text).
export function printerError(e) {
  const m = messageOf(e);
  if (/Nearby devices|No printer chosen|works in the Android app/i.test(m)) return m;
  if (/bluetooth.*(off|disabled|not enabled)|adapter/i.test(m)) return 'Bluetooth is off. Turn it on and try again.';
  if (/socket|connect|IOException|timeout|closed|refused|read failed|broken pipe|not found|unavailable/i.test(m)) {
    return 'Could not reach the printer. Check it is on, paired and close by, then try again.';
  }
  return friendlyError(m) === GENERIC || !m ? 'Printing failed. Check the printer and try again.' : friendlyError(m);
}

// Reasons returned by the Android notification setup.
export function alertsError(reason) {
  const r = String(reason || '');
  if (!r || /not registered/i.test(r)) return 'Not turned on yet.';
  if (/permission|denied|blocked/i.test(r)) return 'Notifications are blocked. Allow them for KLG Delivery in phone settings.';
  if (/not signed in/i.test(r)) return 'Sign in again to turn on alerts.';
  if (isNetwork(r) || /HTTP|server/i.test(r)) return 'Could not reach the server. Check the internet and try again.';
  return 'Could not turn on alerts. Please try again.';
}
