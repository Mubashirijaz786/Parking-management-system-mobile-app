import * as SecureStore from 'expo-secure-store';

const API_URL = (process.env.EXPO_PUBLIC_ADMIN_API_URL ?? 'http://10.0.2.2:4000').replace(/\/$/, '');
const TOKEN_KEY = 'parkease_admin_token';

export type AdminDashboard = { totalCustomers: number; activeSubscriptions: number; expiringSoon: number; expiredSubscriptions: number; monthlyRevenue: number | string; outstandingPayments: number | string; totalRevenue: number | string; totalUnpaidInvoices: number; totalReferralRewards: number | string; devices: number; monthlySubscribers: number; yearlySubscribers: number; newCustomers: number; renewals: number };
export type AdminCustomer = { id: string; customerCode: string; fullName: string; businessName: string; phone: string; whatsapp?: string | null; city: string; address?: string | null; status: string; registeredAt: string; devices: any[]; subscriptions: any[]; payments?: any[]; referrals?: any[] };
export type CustomerUpdate = Partial<Pick<AdminCustomer, 'fullName' | 'businessName' | 'phone' | 'whatsapp' | 'city' | 'address'>>;

const token = () => SecureStore.getItemAsync(TOKEN_KEY);
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const auth = await token();
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}), ...(options.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) { if (response.status === 401) await SecureStore.deleteItemAsync(TOKEN_KEY); throw new Error(body.error ?? `Request failed (${response.status})`); }
  return body as T;
}
const json = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

export const adminApi = {
  login: async (email: string, password: string) => { const result = await request<{ token: string; admin: any }>('/auth/login', { ...json({ email, password }) }); await SecureStore.setItemAsync(TOKEN_KEY, result.token); return result.admin; },
  logout: () => SecureStore.deleteItemAsync(TOKEN_KEY),
  hasSession: async () => Boolean(await token()),
  dashboard: () => request<AdminDashboard>('/admin/dashboard'),
  plans: () => request<any[]>('/admin/plans'),
  createPlan: (body: { code: string; name: string; validityDays: number; price: number }) => request<any>('/admin/plans', json(body)),
  updatePlan: (id: string, body: { code: string; name: string; validityDays: number; price: number }) => request<any>(`/admin/plans/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  customers: (search = '', status: 'ACTIVE' | 'ARCHIVED' | 'ALL' = 'ACTIVE') => request<AdminCustomer[]>(`/admin/customers?status=${encodeURIComponent(status)}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  customer: (id: string) => request<AdminCustomer>(`/admin/customers/${id}`),
  createCustomer: (body: unknown) => request<AdminCustomer>('/admin/customers', json(body)),
  updateCustomer: (id: string, body: CustomerUpdate) => request<AdminCustomer>(`/admin/customers/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  archiveCustomer: (id: string) => request<AdminCustomer>(`/admin/customers/${id}/archive`, json({})),
  replaceDevice: (customerId: string, body: { deviceIdentifier: string; label?: string }) => request<any>(`/admin/customers/${customerId}/devices`, json(body)),
  issueLicense: (subscriptionId: string, deviceId: string) => request<{ activationCode: string; licenseId: string; expiresAt: string }>(`/admin/subscriptions/${subscriptionId}/licenses`, json({ subscriptionId, deviceId })),
  renewSubscription: (subscriptionId: string, body: { planId?: string; paymentAmount?: number; paymentMethod?: string }) => request<any>(`/admin/subscriptions/${subscriptionId}/renew`, json(body)),
  suspendRenewals: (subscriptionId: string) => request<any>(`/admin/subscriptions/${subscriptionId}/suspend-renewals`, json({})),
  suspendSubscription: (subscriptionId: string) => request<any>(`/admin/subscriptions/${subscriptionId}/suspend`, json({})),
  recordPayment: (customerId: string, body: unknown) => request<any>(`/admin/customers/${customerId}/payments`, json(body)),
  refundPayment: (customerId: string, paymentId: string) => request<any>(`/admin/customers/${customerId}/payments/${paymentId}/refund`, json({})),
  recordAdjustment: (customerId: string, body: { amount: number; reason: string; invoiceId?: string; subscriptionId?: string }) => request<any>(`/admin/customers/${customerId}/adjustments`, json(body)),
  notifications: () => request<any>('/admin/notifications'),
  payments: () => request<any[]>('/admin/payments'),
  subscriptions: () => request<any[]>('/admin/subscriptions'),
  reports: () => request<any>('/admin/reports'),
  referrals: () => request<any[]>('/admin/referrals'),
  createReferral: (customerId: string) => request<any>(`/admin/customers/${customerId}/referrals`, json({})),
  verifyReferral: (claimId: string, amount: number) => request<any>(`/admin/referral-claims/${claimId}/verify`, json({ amount })),
  issueReferralReward: (rewardId: string) => request<any>(`/admin/referral-rewards/${rewardId}/issue`, json({})),
  acknowledgeActivation: (licenseId: string, deviceIdentifier: string, acknowledgement: string) => request<any>('/activation/acknowledge', json({ licenseId, deviceIdentifier, acknowledgement })),
};
