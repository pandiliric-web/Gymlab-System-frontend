import { apiRequest } from './api';
import { getApiBaseUrl } from '../utils/apiBaseUrl';

/** No auth — each call deducts one session when balance is above zero. */
export async function checkBalanceUseSession(customerId) {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/members/check-balance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId: String(customerId || '').trim() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data?.error ||
      (res.status === 404
        ? 'No account found for that Customer ID, or the server could not be reached. Use the same ID as login / registration (letters and numbers only).'
        : `Request failed (${res.status})`);
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function createWalkInClient(payload) {
  return apiRequest('/api/admin/walkin', { method: 'POST', body: payload || {} });
}

export async function createPaymentRequest(courseId) {
  const requestPayload =
    typeof courseId === 'string'
      ? { courseId }
      : {
          courseId: courseId?.courseId,
          formData: courseId?.formData || null,
        };
  return apiRequest('/api/payments/request', { method: 'POST', body: requestPayload });
}

export async function markPaymentPaid(paymentId) {
  return apiRequest(`/api/payments/${encodeURIComponent(paymentId)}/mark-paid`, { method: 'POST' });
}

export async function adminCreateMember(payload) {
  return apiRequest('/api/admin/members', { method: 'POST', body: payload || {} });
}

export async function adminDeleteMember(payload) {
  return apiRequest('/api/admin/members', { method: 'DELETE', body: payload || {} });
}

export async function listUsers() {
  return apiRequest('/api/users');
}

export async function listPayments(query = {}) {
  const qs = new URLSearchParams();
  if (query.userId) qs.set('userId', query.userId);
  if (query.status) qs.set('status', query.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiRequest(`/api/payments${suffix}`);
}

export async function getPaymentById(paymentId) {
  return apiRequest(`/api/payments/${encodeURIComponent(paymentId)}`);
}

export async function getPricingSettings() {
  return apiRequest('/api/settings/pricing');
}

export async function savePricingSettingsApi(payload) {
  return apiRequest('/api/settings/pricing', { method: 'PUT', body: payload || {} });
}

