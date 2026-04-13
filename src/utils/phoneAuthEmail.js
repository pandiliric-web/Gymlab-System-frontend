function normalizeMemberIdValue(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Customer ID format:
 *   "c" + 10 lowercase alphanumeric chars
 * Example: c4m9k2p8q1z
 */
export function createCustomerId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  const raw = `${ts}${rand}`.slice(-10);
  return normalizeMemberIdValue(`c${raw}`);
}

/**
 * New Customer ID format (requested):
 *   MMDDYYYY + first 3 letters of first name
 * Example: 03102003ric
 */
export function createCustomerIdFromProfile(fullName, birthday) {
  const name = String(fullName || '').trim().toLowerCase();
  const first = (name.split(/\s+/).find(Boolean) || '').replace(/[^a-z]/g, '');
  const first3 = (first.slice(0, 3) || '').padEnd(3, 'x');

  const b = String(birthday || '').trim(); // expected: YYYY-MM-DD
  const m = b.slice(5, 7);
  const d = b.slice(8, 10);
  const y = b.slice(0, 4);
  const mm = /^\d{2}$/.test(m) ? m : '00';
  const dd = /^\d{2}$/.test(d) ? d : '00';
  const yyyy = /^\d{4}$/.test(y) ? y : '0000';

  return normalizeMemberIdValue(`${mm}${dd}${yyyy}${first3}`);
}

/** Firebase Email/Password auth still requires email, so we map customer ID -> synthetic email. */
export function customerIdToAuthEmail(customerId) {
  const normalized = normalizeMemberIdValue(customerId);
  if (!normalized) return null;
  return `${normalized}@member.clutchlab.local`;
}

export function authEmailToCustomerId(email) {
  const t = String(email || '').trim().toLowerCase();
  const suffix = '@member.clutchlab.local';
  if (!t.endsWith(suffix)) return null;
  const id = t.slice(0, -suffix.length);
  return normalizeMemberIdValue(id) || null;
}

// Backward compatible aliases (to avoid breaking existing imports immediately).
export const createMemberId = createCustomerId;
export const memberIdToAuthEmail = customerIdToAuthEmail;
export const authEmailToMemberId = authEmailToCustomerId;

/**
 * Login normalization:
 * - email stays email (admin fallback)
 * - otherwise treat as customer ID and map to synthetic auth email
 */
export function normalizeLoginIdentifier(input) {
  const t = String(input || '').trim();
  if (!t) return '';
  if (t.includes('@')) return t.toLowerCase();
  return customerIdToAuthEmail(t) || t;
}
