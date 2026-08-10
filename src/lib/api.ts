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

export type EmployeeType = "employee" | "contractor";
export type TeamPaymentSchedule = "monthly" | "weekly";
export type ContractorPaymentCadence = TeamPaymentSchedule | "on_demand";
export type RecipientRoleTitle = "Developer" | "Product" | "Growth" | "Finance" | "Operations";

export type TeamPaymentDateKey =
  | "every_1st"
  | "every_15th"
  | "every_end_of_month"
  | "every_monday"
  | "every_tuesday"
  | "every_wednesday"
  | "every_thursday"
  | "every_friday"
  | "every_saturday"
  | "every_sunday";

export interface Employee {
  id: string;
  user_id: string | null;
  email: string | null;
  name: string;
  role_title: string;
  location: string;
  employee_type: EmployeeType;
  token: "USDC" | "USDT";
  network: string;
  amount_minor: number;
  endpoint: string;
  status: "ready" | "pending" | "update_required";
  payout_verified_at: string | null;
  last_paid_at: string | null;
  created_at: string;
  /** Effective schedule (team for employees; own for contractors). */
  payment_cadence?: ContractorPaymentCadence | TeamPaymentSchedule | null;
  payment_date_key?: TeamPaymentDateKey | null;
  nextPayday?: string | null;
  nextPaydayDisplay?: string | null;
}

export interface EmployeeListResult {
  employees: Employee[];
  total: number;
  page: number;
  pageSize: number;
  counts: { all: number; employees: number; contractors: number };
}

export interface EmployeePaymentHistoryItem {
  id: string;
  paid_at: string;
  amount_minor: number;
  token: string;
  network: string;
  period_key: string;
  txHash: string | null;
  explorerUrl: string | null;
}

export interface ListEmployeesParams {
  q?: string;
  type?: EmployeeType | "";
  page?: number;
  pageSize?: number;
}

export interface PayOverview {
  org: { id: string; name: string };
  period: {
    periodKey: string;
    payday: string;
    paydayDisplay: string;
    cadence: TeamPaymentSchedule;
    monthLabel: string;
  };
  stats: {
    currentPayrollMinor: number;
    recipientsCount: number;
    progress: number;
  };
  recipients: Array<{
    id: string;
    name: string;
    role_title: string | null;
    employee_type: EmployeeType;
    verified: boolean;
    status: string;
    created_at: string;
  }>;
  highPriority: {
    verification: { count: number; names: string[] } | null;
  };
}

export interface QuickPayAsset {
  assetId: string;
  decimals: number;
  blockchain: string;
  network: string;
  symbol: "USDC" | "USDT";
  providerSymbol: string;
  contractAddress: string | null;
}

export interface QuickPayQuote {
  amountIn: string;
  amountOut: string;
  depositAddress?: string | null;
  depositMemo?: string | null;
  timeEstimate?: number | string | null;
  deadline?: string | null;
  originAsset: QuickPayAsset;
  destinationAsset: QuickPayAsset;
  confidentiality: string;
}

export interface PayrollRun {
  id: string;
  label: string;
  pay_date: string;
  status: "draft" | "ready" | "processing" | "paid" | "failed" | "partial";
  created_by: string;
  created_at: string;
  itemCount: number;
  usdcMinor: number;
  usdtMinor: number;
  cadence: PayrollCadence;
  schedule_id: string | null;
  source: "manual" | "schedule";
}

export type PayrollCadence = "manual" | "weekly" | "biweekly" | "monthly";

export interface PayrollSchedule {
  id: string;
  name: string;
  cadence: Exclude<PayrollCadence, "manual">;
  next_pay_date: string;
  last_generated_date: string;
  draft_lead_days: number;
  active: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface PayrollImportRow {
  employeeEmail: string;
  employeeName: string;
  amount: string;
  token: string;
  network: string;
}

export interface PayrunItem {
  id: string;
  run_id: string;
  employee_id: string | null;
  employee_name: string;
  amount_minor: number;
  token: "USDC" | "USDT";
  network: string;
  status: "pending" | "processing" | "paid" | "failed" | "refunded";
  payment_attempt_id?: string | null;
  payment_state?: PaymentAttemptState | null;
  provider_status?: string | null;
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
  amount_minor: number;
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
  attempt_id?: string | null;
  provider_status?: string | null;
}

export type PaymentAttemptState =
  | "created"
  | "quoting"
  | "quoted"
  | "generating"
  | "awaiting_signature"
  | "submitting"
  | "submitted"
  | "awaiting_deposit"
  | "deposit_submitted"
  | "processing"
  | "confirmed"
  | "failed"
  | "refunded";

export interface PaymentAttempt {
  id: string;
  org_id: string;
  run_id: string | null;
  item_id: string | null;
  employee_payment_id?: string | null;
  idempotency_key: string;
  state: PaymentAttemptState;
  token: "USDC" | "USDT";
  network: string;
  amount_minor: number;
  recipient: string;
  signer_id: string;
  origin_asset_id?: string | null;
  destination_asset_id?: string | null;
  deposit_address: string | null;
  deposit_memo: string | null;
  deposit_tx_hash?: string | null;
  intent_hash: string | null;
  provider_status: string | null;
  last_error: string | null;
  quote_request?: string | null;
  quote_response?: string | null;
  quote_expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: "admin" | "employee";
  role_title?: string | null;
  name?: string | null;
  employee_type?: EmployeeType | null;
  status: string;
  expires_at: string;
  created_at: string;
}

export interface InviteMailResult {
  ok: boolean;
  mock?: boolean;
}

/** Team payment schedule stored on organizations (not payroll_runs). */
export interface OrgPaymentFields {
  payment_cadence: TeamPaymentSchedule | null;
  payment_date_key: TeamPaymentDateKey | null;
  reminder_lead_days: number | null;
  payment_configured_at: string | null;
}

export interface OrgContext {
  org: {
    id: string;
    name: string;
    country: string | null;
  } & OrgPaymentFields;
  memberCount: number;
  paymentConfigured: boolean;
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
    const payload = data as { error?: string; code?: string; detail?: string } | null;
    const msg = payload?.error || `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, payload?.code, typeof payload?.detail === "string" ? payload.detail : undefined);
  }
  return data as T;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  /** Raw provider error body (e.g. 1Click JSON) forwarded by the Worker. */
  detail?: string;
  constructor(message: string, status: number, code?: string, detail?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.detail = detail;
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
  createInvite: (body: {
    email: string;
    name: string;
    role?: string;
    role_title?: RecipientRoleTitle | string;
    employee_type?: EmployeeType;
  }) =>
    request<{ invitation: Invitation; mail: InviteMailResult; inviteUrl?: string }>("/invites", { method: "POST", body: JSON.stringify(body) }),
  resolveInvite: (token: string) => request<{ invitation: { email: string; role: string; orgName: string; accountExists: boolean } }>(`/invites/resolve/${token}`),
  acceptInvite: (body: { token: string; email: string; name: string; password: string }) =>
    request<{ ok: boolean; user: AuthUser }>("/invites/accept", { method: "POST", body: JSON.stringify(body) }),
  resendInvite: (id: string) => request<{ ok: boolean; mail: InviteMailResult; inviteUrl?: string }>(`/invites/${id}/resend`, { method: "POST" }),
  revokeInvite: (id: string) => request<{ ok: boolean }>(`/invites/${id}/revoke`, { method: "POST" }),

  // org + employees
  // Phase 1: orgContext reflects the single workspace on user.org_id.
  // Future multi-org: pass / select activeOrgId from memberships.
  orgContext: () => request<OrgContext>("/org/context"),
  org: () => request<OrgInfo>("/org"),
  updateOrg: (body: { name?: string; country?: string }) => request<{ org: { id: string; name: string; country: string | null } }>("/org", { method: "PATCH", body: JSON.stringify(body) }),
  /** Configure team payment preferences. Does not create payroll runs. */
  updateTeam: (body: { paymentSchedule: TeamPaymentSchedule; paymentDate: TeamPaymentDateKey }) =>
    request<{ org: { id: string; name: string; country: string | null } & OrgPaymentFields }>("/org/team", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  listEmployees: (params?: ListEmployeesParams) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.type) qs.set("type", params.type);
    if (params?.page !== undefined) qs.set("page", String(params.page));
    if (params?.pageSize !== undefined) qs.set("pageSize", String(params.pageSize));
    const query = qs.toString();
    return request<EmployeeListResult>(`/org/employees${query ? `?${query}` : ""}`);
  },
  listEmployeePayments: (id: string, params?: { limit?: number; cursor?: string | null }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.cursor) qs.set("cursor", params.cursor);
    const query = qs.toString();
    return request<{ payments: EmployeePaymentHistoryItem[]; nextCursor: string | null }>(
      `/org/employees/${id}/payments${query ? `?${query}` : ""}`,
    );
  },
  payOverview: () => request<PayOverview>("/org/pay-overview"),
  createEmployee: (body: Partial<Employee> & {
    amount?: string;
    employee_type?: EmployeeType;
    payment_cadence?: ContractorPaymentCadence;
    payment_date_key?: TeamPaymentDateKey | null;
  }) => request<{ employee: Employee }>("/org/employees", { method: "POST", body: JSON.stringify(body) }),
  updateEmployee: (id: string, body: Partial<Employee> & {
    amount?: string;
    employee_type?: EmployeeType;
    payment_cadence?: ContractorPaymentCadence;
    payment_date_key?: TeamPaymentDateKey | null;
  }) =>
    request<{ employee: Employee }>(`/org/employees/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteEmployee: (id: string) => request<{ ok: boolean }>(`/org/employees/${id}`, { method: "DELETE" }),

  // payroll
  listRuns: () => request<{ runs: PayrollRun[] }>("/payroll"),
  createRun: (body: { label: string; payDate: string; cadence?: PayrollCadence }) => request<{ run: PayrollRun }>("/payroll", { method: "POST", body: JSON.stringify(body) }),
  listPayrollSchedules: () => request<{ schedules: PayrollSchedule[] }>("/payroll/schedules"),
  updatePayrollSchedule: (id: string, body: { name?: string; cadence?: Exclude<PayrollCadence, "manual">; nextPayDate?: string; active?: boolean }) =>
    request<{ schedule: PayrollSchedule }>(`/payroll/schedules/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  archivePayrollSchedule: (id: string) => request<{ ok: boolean; archivedAt: string }>(`/payroll/schedules/${id}`, { method: "DELETE" }),
  getRun: (id: string) => request<{ run: PayrollRun; items: PayrunItem[] }>(`/payroll/${id}`),
  addItem: (runId: string, body: { employeeId?: string; employeeName?: string; amount: string; token?: string; network?: string }) =>
    request<{ item: PayrunItem }>(`/payroll/${runId}/items`, { method: "POST", body: JSON.stringify(body) }),
  importPayrollItems: (runId: string, rows: PayrollImportRow[]) =>
    request<{ ok: boolean; importedCount: number; linkedCount: number; manualCount: number }>(`/payroll/${runId}/items/import`, { method: "POST", body: JSON.stringify({ rows }) }),
  updatePayrollItem: (runId: string, itemId: string, body: { employeeId?: string | null; employeeName?: string; amount?: string; token?: string; network?: string }) =>
    request<{ item: PayrunItem }>(`/payroll/${runId}/items/${itemId}`, { method: "PATCH", body: JSON.stringify(body) }),
  removePayrollItem: (runId: string, itemId: string) =>
    request<{ ok: boolean; removedAt: string }>(`/payroll/${runId}/items/${itemId}`, { method: "DELETE" }),
  updateRun: (id: string, body: { label?: string; payDate?: string; status?: string }) =>
    request<{ run: PayrollRun }>(`/payroll/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  archiveRun: (id: string) => request<{ ok: boolean; archivedAt: string }>(`/payroll/${id}`, { method: "DELETE" }),
  setRunStatus: (id: string, status: string) =>
    request<{ run: PayrollRun }>(`/payroll/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),

  // records
  listRecords: () => request<{ records: ChainRecord[] }>("/records"),
  myRecords: () => request<{ records: PayrunItem[] }>("/records/me"),
  myPayout: () => request<{ payout: Employee | null }>("/records/me/payout"),
  updatePayout: (body: { token: string; network: string; endpoint: string }) =>
    request<{ ok: boolean }>("/records/me/payout", { method: "PUT", body: JSON.stringify(body) }),
  createPayoutChallenge: (body: { token: string; network: string; endpoint: string }) =>
    request<{ challengeId: string; message: string; address: string; expiresAt: string }>("/records/me/payout/challenge", { method: "POST", body: JSON.stringify(body) }),
  verifyPayout: (body: { challengeId: string; signature: string }) =>
    request<{ ok: boolean; payout: Employee }>("/records/me/payout/verify", { method: "POST", body: JSON.stringify(body) }),
  signConsent: (payload: unknown) => request<{ ok: boolean; signedAt: string }>("/records/consents", { method: "POST", body: JSON.stringify(payload) }),
  myConsent: () => request<{ signed: boolean; signedAt: string | null }>("/records/consents/me"),
  createPaymentWalletChallenge: (address: string) =>
    request<{ challengeId: string; message: string; address: string; expiresAt: string }>("/records/wallet/challenge", { method: "POST", body: JSON.stringify({ address }) }),
  verifyPaymentWallet: (body: { challengeId: string; signature: string }) =>
    request<{ ok: boolean; wallet_address: string; wallet_verified_at: string }>("/records/wallet/verify", { method: "POST", body: JSON.stringify(body) }),
  unbindWallet: () => request<{ ok: boolean }>("/records/wallet", { method: "DELETE" }),

  // payments: dry-run readiness + live 1Click attempts
  quote: (body: { runId: string; dry: true }) => request<{ dry: true; mode: "dry-run"; executionAllowed: false; itemCount: number; validatedItemCount: number; checkedAt: string; totals: { usdcMinor: number; usdtMinor: number } }>("/payments/quote", { method: "POST", body: JSON.stringify(body) }),
  listPaymentAttempts: (runId: string) => request<{ attempts: PaymentAttempt[] }>(`/payments/runs/${runId}/attempts`),
  quotePaymentItem: (itemId: string, idempotencyKey: string) =>
    request<{ attempt: PaymentAttempt; reused: boolean }>(`/payments/items/${itemId}/quote`, { method: "POST", body: JSON.stringify({ idempotencyKey }) }),
  generatePaymentIntent: (attemptId: string) =>
    request<{ attempt: PaymentAttempt; intent: { standard: "erc191"; payload: string }; reused: boolean }>(`/payments/attempts/${attemptId}/intent`, { method: "POST" }),
  submitPaymentAttempt: (attemptId: string, signature: string) =>
    request<{ attempt: PaymentAttempt; reused: boolean; outcome?: "unknown" }>(`/payments/attempts/${attemptId}/submit`, { method: "POST", body: JSON.stringify({ signature }) }),
  reconcilePaymentAttempt: (attemptId: string) =>
    request<{ attempt: PaymentAttempt; reused: boolean }>(`/payments/attempts/${attemptId}/reconcile`, { method: "POST" }),
  reopenFailedPayments: (runId: string) =>
    request<{ ok: true; reopened: number }>(`/payments/runs/${runId}/reopen-failed`, { method: "POST" }),

  /** Quick Pay dry preview (ORIGIN_CHAIN confidential quote). */
  quoteEmployeePaymentDry: (employeeId: string, body: {
    originAsset: string;
    amount?: string;
    destinationToken?: string;
    destinationNetwork?: string;
  }) =>
    request<{ dry: true; quote: QuickPayQuote }>(`/payments/employees/${employeeId}/quote`, {
      method: "POST",
      body: JSON.stringify({ ...body, dry: true }),
    }),

  /** Quick Pay live quote — creates employee_payment + attempt awaiting ORIGIN_CHAIN deposit. */
  quoteEmployeePayment: (employeeId: string, body: {
    originAsset: string;
    amount?: string;
    destinationToken?: string;
    destinationNetwork?: string;
    idempotencyKey: string;
  }) =>
    request<{ attempt: PaymentAttempt; reused: boolean; quote: QuickPayQuote }>(`/payments/employees/${employeeId}/quote`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  submitPaymentDeposit: (attemptId: string, txHash: string) =>
    request<{ attempt: PaymentAttempt; reused: boolean; outcome?: "unknown" }>(
      `/payments/attempts/${attemptId}/deposit`,
      { method: "POST", body: JSON.stringify({ txHash }) },
    ),
};
