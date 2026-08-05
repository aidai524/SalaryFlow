// Frontend API client — calls same-origin /api (proxied to Worker in dev)

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "employee";
  org_id: string | null;
  wallet_address: string | null;
  wallet_verified: boolean;
}

export interface Employee {
  id: string;
  user_id: string | null;
  name: string;
  role_title: string;
  location: string;
  token: "USDC" | "USDT";
  network: string;
  amount: number;
  endpoint: string;
  status: "ready" | "pending" | "update_required";
  last_paid_at: string | null;
  created_at: string;
}

export interface PayrollRun {
  id: string;
  label: string;
  pay_date: string;
  status: "draft" | "ready" | "paid" | "failed" | "partial";
  created_by: string;
  created_at: string;
  itemCount: number;
  usdc: number;
  usdt: number;
}

export interface PayrunItem {
  id: string;
  run_id: string;
  employee_id: string | null;
  employee_name: string;
  amount: number;
  token: "USDC" | "USDT";
  network: string;
  status: "pending" | "paid" | "failed" | "refunded";
  intent_hash: string | null;
  deposit_address: string | null;
  signed_at: string | null;
  submitted_at: string | null;
  confirmed_at: string | null;
  error: string | null;
  created_at: string;
}

export interface ChainRecord {
  id: string;
  item_id: string | null;
  employee_name: string;
  token: string;
  network: string;
  amount: number;
  origin_chain: string | null;
  dest_chain: string | null;
  confidentiality: string;
  intent_hash: string | null;
  status: string;
  quote_at: string | null;
  signed_at: string | null;
  submitted_at: string | null;
  confirmed_at: string | null;
  error: string | null;
}

export interface Invitation {
  id: string;
  email: string;
  role: "admin" | "employee";
  status: string;
  expires_at: string;
  created_at: string;
}

export interface OrgInfo {
  org: {
    id: string;
    name: string;
    country: string | null;
    created_at: string;
  };
  members: Array<{ id: string; name: string; email: string; role: string; status: string; wallet_address: string | null }>;
  pendingInvites: number;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error || `Request failed (${res.status})`;
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const api = {
  // auth
  register: (body: { email: string; password: string; name: string; orgName: string }) =>
    request<{ user: AuthUser }>("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request<{ user: AuthUser }>("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  me: () => request<{ user: AuthUser | null }>("/auth/me"),
  updateMe: (body: { name?: string }) => request<{ user: AuthUser }>("/auth/me", { method: "PATCH", body: JSON.stringify(body) }),

  // invites
  listInvites: () => request<{ invitations: Invitation[] }>("/invites"),
  createInvite: (body: { email: string; role: string }) =>
    request<{ invitation: Invitation; inviteUrl?: string }>("/invites", { method: "POST", body: JSON.stringify(body) }),
  resolveInvite: (token: string) => request<{ invitation: { email: string; role: string; orgName: string } }>(`/invites/resolve/${token}`),
  acceptInvite: (body: { token: string; email: string; name: string; password: string }) =>
    request<{ ok: boolean; user: AuthUser }>("/invites/accept", { method: "POST", body: JSON.stringify(body) }),
  resendInvite: (id: string) => request<{ ok: boolean; inviteUrl?: string }>(`/invites/${id}/resend`, { method: "POST" }),
  revokeInvite: (id: string) => request<{ ok: boolean }>(`/invites/${id}/revoke`, { method: "POST" }),

  // org + employees
  org: () => request<OrgInfo>("/org"),
  updateOrg: (body: { name?: string; country?: string }) => request<{ org: { id: string; name: string; country: string | null } }>("/org", { method: "PATCH", body: JSON.stringify(body) }),
  listEmployees: () => request<{ employees: Employee[] }>("/org/employees"),
  createEmployee: (body: Partial<Employee>) => request<{ employee: Employee }>("/org/employees", { method: "POST", body: JSON.stringify(body) }),
  updateEmployee: (id: string, body: Partial<Employee>) =>
    request<{ employee: Employee }>(`/org/employees/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteEmployee: (id: string) => request<{ ok: boolean }>(`/org/employees/${id}`, { method: "DELETE" }),

  // payroll
  listRuns: () => request<{ runs: PayrollRun[] }>("/payroll"),
  createRun: (body: { label: string; payDate: string }) => request<{ run: PayrollRun }>("/payroll", { method: "POST", body: JSON.stringify(body) }),
  getRun: (id: string) => request<{ run: PayrollRun; items: PayrunItem[] }>(`/payroll/${id}`),
  addItem: (runId: string, body: { employeeId?: string; employeeName?: string; amount: number; token?: string; network?: string }) =>
    request<{ item: PayrunItem }>(`/payroll/${runId}/items`, { method: "POST", body: JSON.stringify(body) }),
  setRunStatus: (id: string, status: string) =>
    request<{ ok: boolean }>(`/payroll/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),

  // records
  listRecords: () => request<{ records: ChainRecord[] }>("/records"),
  myRecords: () => request<{ records: PayrunItem[] }>("/records/me"),
  myPayout: () => request<{ payout: Employee | null }>("/records/me/payout"),
  updatePayout: (body: { token: string; network: string; endpoint: string }) =>
    request<{ ok: boolean }>("/records/me/payout", { method: "PUT", body: JSON.stringify(body) }),
  signConsent: (payload: unknown) => request<{ ok: boolean; signedAt: string }>("/records/consents", { method: "POST", body: JSON.stringify(payload) }),
  myConsent: () => request<{ signed: boolean; signedAt: string | null }>("/records/consents/me"),
  bindWallet: (address: string) => request<{ ok: boolean }>("/records/wallet", { method: "PUT", body: JSON.stringify({ address }) }),
  unbindWallet: () => request<{ ok: boolean }>("/records/wallet", { method: "DELETE" }),

  // payments (1Click proxy)
  quote: (body: { runId: string; dry?: boolean }) => request<{ quote: unknown; recordId: string; dry: boolean; itemCount: number }>("/payments/quote", { method: "POST", body: JSON.stringify(body) }),
  generateIntent: (body: { depositAddress: string; signerId: string; standard: string }) =>
    request<{ intent: { standard: string; payload: unknown }; correlationId: string }>("/payments/generate-intent", { method: "POST", body: JSON.stringify(body) }),
  submitIntent: (body: { signedData: unknown; recordId?: string }) =>
    request<{ intentHash: string }>("/payments/submit-intent", { method: "POST", body: JSON.stringify(body) }),
  swapStatus: (body: { depositAddress: string; depositMemo?: string }) =>
    request<{ status: string }>("/payments/status", { method: "POST", body: JSON.stringify(body) }),
};
