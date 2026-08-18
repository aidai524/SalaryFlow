// Frontend API client — calls same-origin /api (proxied to Worker in dev)

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "employee";
  org_id: string | null;
  wallet_address: string | null;
  wallet_verified: boolean;
  must_change_password: boolean;
}

export type EmployeeType = "employee" | "contractor" | "others";
export type TeamPaymentSchedule = "monthly" | "weekly";
export type ContractorPaymentCadence = TeamPaymentSchedule | "on_demand";
export type RecipientRoleTitle = "Developer" | "Product" | "Growth" | "Finance" | "Operations" | "Other";

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
  /** Preset path e.g. /avatars/avatar-1.png */
  avatar_url?: string | null;
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
  counts: { all: number; employees: number; contractors: number; others: number };
}

export interface EmployeePaymentHistoryItem {
  id: string;
  paid_at: string;
  amount_minor: number;
  token: string;
  network: string;
  period_key: string;
  status: "pending" | "processing" | "paid" | "failed" | "refunded" | string;
  /** Admin-only transfer memo (not shown to recipient wallets on-chain). */
  memo: string | null;
  /** Destination-chain receive tx only — not admin funding/deposit. */
  txHash: string | null;
  explorerUrl: string | null;
}

/** Employee self-service payout / profile summary from GET /records/me/payout. */
export interface MyPayout {
  id: string;
  name: string;
  email: string | null;
  role_title: string | null;
  employee_type: EmployeeType;
  token: "USDC" | "USDT";
  network: string;
  amount_minor: number;
  endpoint: string;
  status: "ready" | "pending" | "update_required";
  payout_verified_at: string | null;
  last_paid_at: string | null;
  created_at: string;
  payment_cadence?: ContractorPaymentCadence | TeamPaymentSchedule | null;
  payment_date_key?: TeamPaymentDateKey | null;
  nextPayday?: string | null;
  nextPaydayDisplay?: string | null;
  avatar_url?: string | null;
  totalReceivedMinor: number;
}

/** Employee self-service payment history row from GET /records/me. */
export interface MyPaymentHistoryItem {
  id: string;
  paid_at: string;
  amount_minor: number;
  token: string;
  network: string;
  period_key: string;
  status: "pending" | "processing" | "paid" | "failed" | "refunded";
  memo: string | null;
  /** Destination-chain receive tx only — never admin funding/deposit. */
  txHash: string | null;
  explorerUrl: string | null;
}

export interface ListEmployeesParams {
  q?: string;
  type?: EmployeeType | "";
  page?: number;
  pageSize?: number;
  sort?: "last_paid";
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
    avatar_url?: string | null;
  }>;
  highPriority: {
    verification: { count: number; names: string[] } | null;
  };
}

export interface OrgOverview {
  org: { id: string; name: string };
  period: {
    periodKey: string;
    payday: string;
    paydayDisplay: string;
    nextPayday: string;
    nextPaydayDisplay: string;
    cadence: TeamPaymentSchedule;
    monthLabel: string;
    currentPeriodKey: string;
  };
  stats: {
    paidMinor: number;
    paidCount: number;
    awaitingMinor: number;
    awaitingCount: number;
    daysLeft: number;
    progress: number;
    recipientsCount: number;
  };
  volume: {
    range: 6 | 12;
    cadence: TeamPaymentSchedule;
    bars: Array<{
      periodKey: string;
      label: string;
      amountMinor: number;
      changePct: number | null;
      isCurrent: boolean;
    }>;
  };
  upcoming: Array<{
    periodKey: string;
    title: string;
    payday: string;
    paydayDisplay: string;
    employeeCount: number;
    amountMinor: number;
  }>;
  recentPayments: Array<{
    id: string;
    employeeId: string;
    name: string;
    role_title: string | null;
    amount_minor: number;
    token: string;
    network: string;
    status: "paid" | "processing";
    paid_at: string;
    period_key: string;
    avatar_url?: string | null;
  }>;
  category: Array<{
    type: EmployeeType;
    label: string;
    count: number;
    pct: number;
  }>;
  networks: Array<{
    network: string;
    count: number;
    pct: number;
  }>;
}

export interface OrgPaymentRow {
  id: string;
  /** Null for ad-hoc address Quick Pay. */
  employeeId: string | null;
  name: string;
  role_title: string | null;
  employee_type: EmployeeType;
  avatar_url?: string | null;
  amount_minor: number;
  token: string;
  network: string;
  status: string;
  paid_at: string;
  period_key: string;
  memo: string | null;
  /** Admin origin-chain deposit / funding tx. */
  adminTxHash: string | null;
  adminExplorerUrl: string | null;
  /** Employee destination / receive settlement tx. */
  receiveTxHash: string | null;
  receiveExplorerUrl: string | null;
}

export type PaymentBatchStatus = "processing" | "partial" | "completed" | "failed";

export interface PaymentBatchSummary {
  id: string;
  originAssetId: string;
  originNetwork: string;
  originToken: string;
  contractAddress: string;
  batchId: string;
  txHash: string;
  adminExplorerUrl: string | null;
  totalAmountIn: string;
  itemCount: number;
  status: PaymentBatchStatus;
  paidCount: number;
  failedCount: number;
  processingCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentBatchItemRow {
  id: string;
  employeeId: string | null;
  employeeName: string;
  amountMinor: number;
  token: string;
  network: string;
  memo: string | null;
  status: string;
  adminTxHash: string | null;
  adminExplorerUrl: string | null;
  receiveTxHash: string | null;
  receiveExplorerUrl: string | null;
}

export interface PaymentBatchListResult {
  batches: PaymentBatchSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PaymentBatchDetailResult {
  batch: PaymentBatchSummary;
  items: PaymentBatchItemRow[];
}

export type QuickPayQuoteTarget = {
  originAsset: string;
  amount?: string;
  destinationToken?: string;
  destinationNetwork?: string;
  mode?: QuickPayMode;
  memo?: string | null;
} & (
  | { employeeId: string; destinationAddress?: never }
  | { destinationAddress: string; employeeId?: never }
);

export interface OrgPaymentsResult {
  org: { id: string; name: string };
  period: {
    periodKey: string;
    payday: string;
    paydayDisplay: string;
    cadence: TeamPaymentSchedule;
    monthLabel: string;
  };
  payments: OrgPaymentRow[];
}

export interface OrgOverviewParams {
  periodKey?: string;
  volumeRange?: 6 | 12;
}

export interface ListOrgPaymentsParams {
  periodKey?: string;
  q?: string;
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

export type QuickPayMode = "private" | "standard";

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
  payoutAmountIn?: string;
  fundingAmountOut?: string;
}

export interface PrivateFundingQuote {
  depositAddress: string;
  depositMemo?: string | null;
  amountIn: string;
  amountOut?: string;
  deadline?: string | null;
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
  | "funding_quoted"
  | "funding_deposit_submitted"
  | "funding_processing"
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
  flow?: QuickPayMode;
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
  intent_payload?: string | null;
  intent_signature?: string | null;
  intent_hash: string | null;
  funding_deposit_address?: string | null;
  funding_deposit_memo?: string | null;
  funding_tx_hash?: string | null;
  funding_expires_at?: string | null;
  provider_status: string | null;
  last_error: string | null;
  quote_request?: string | null;
  quote_response?: string | null;
  quote_expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PendingPaymentRow {
  attemptId: string;
  flow: QuickPayMode;
  state: PaymentAttemptState;
  token: string;
  network: string;
  amountMinor: number;
  recipient: string;
  employeeId: string | null;
  employeeName: string;
  providerStatus: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  employeePaymentId: string | null;
  itemId: string | null;
  runId: string | null;
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
  attentionCount: number;
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
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
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
  registrationConfig: () => request<{ inviteRequired: boolean }>("/auth/registration"),
  register: (body: { email: string; password: string; name: string; orgName: string; inviteCode?: string }) =>
    request<{ user: AuthUser }>("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request<{ user: AuthUser }>("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  me: () => request<{ user: AuthUser | null }>("/auth/me"),
  updateMe: (body: { name?: string }) => request<{ user: AuthUser }>("/auth/me", { method: "PATCH", body: JSON.stringify(body) }),
  changePassword: (body: { currentPassword?: string; newPassword: string }) =>
    request<{ ok: true; user: AuthUser }>("/auth/change-password", { method: "POST", body: JSON.stringify(body) }),

  // invites
  listInvites: () => request<{ invitations: Invitation[] }>("/invites"),
  createInvite: (body: {
    email: string;
    name: string;
    role?: string;
    role_title?: RecipientRoleTitle | string;
    employee_type?: EmployeeType;
  }) =>
    request<{ invitation: Invitation; mail: InviteMailResult; inviteUrl?: string; resent?: boolean }>("/invites", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  resolveInvite: (token: string) =>
    request<{ invitation: { email: string; name: string; role: string; orgName: string; accountExists: boolean } }>(
      `/invites/resolve/${token}`,
    ),
  acceptInvite: (body: { token: string }) =>
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
    if (params?.sort) qs.set("sort", params.sort);
    const query = qs.toString();
    return request<EmployeeListResult>(`/org/employees${query ? `?${query}` : ""}`);
  },
  getEmployee: (id: string) => request<{ employee: Employee }>(`/org/employees/${id}`),
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
  orgOverview: (params?: OrgOverviewParams) => {
    const qs = new URLSearchParams();
    if (params?.periodKey) qs.set("periodKey", params.periodKey);
    if (params?.volumeRange) qs.set("volumeRange", String(params.volumeRange));
    const query = qs.toString();
    return request<OrgOverview>(`/org/overview${query ? `?${query}` : ""}`);
  },
  listOrgPayments: (params?: ListOrgPaymentsParams) => {
    const qs = new URLSearchParams();
    if (params?.periodKey) qs.set("periodKey", params.periodKey);
    if (params?.q) qs.set("q", params.q);
    const query = qs.toString();
    return request<OrgPaymentsResult>(`/org/payments${query ? `?${query}` : ""}`);
  },
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
  myRecords: (params?: { limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit != null) q.set("limit", String(params.limit));
    const qs = q.toString();
    return request<{ payments: MyPaymentHistoryItem[] }>(`/records/me${qs ? `?${qs}` : ""}`);
  },
  myPayout: () => request<{ payout: MyPayout | null }>("/records/me/payout"),
  updateMyProfile: (body: {
    name?: string;
    email?: string | null;
    token?: string;
    network?: string;
    endpoint?: string;
    avatar_url?: string | null;
  }) =>
    request<{ payout: MyPayout | null; payoutChanged: boolean }>("/records/me/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  updatePayout: (body: { token: string; network: string; endpoint: string }) =>
    request<{ ok: boolean }>("/records/me/payout", { method: "PUT", body: JSON.stringify(body) }),
  createPayoutChallenge: (body: { token: string; network: string; endpoint: string }) =>
    request<{ challengeId: string; message: string; address: string; expiresAt: string }>("/records/me/payout/challenge", { method: "POST", body: JSON.stringify(body) }),
  verifyPayout: (body: { challengeId: string; signature: string }) =>
    request<{ ok: boolean; payout: MyPayout }>("/records/me/payout/verify", { method: "POST", body: JSON.stringify(body) }),
  signConsent: (payload: unknown) => request<{ ok: boolean; signedAt: string }>("/records/consents", { method: "POST", body: JSON.stringify(payload) }),
  myConsent: () => request<{ signed: boolean; signedAt: string | null }>("/records/consents/me"),
  createPaymentWalletChallenge: (address: string) =>
    request<{ challengeId: string; message: string; address: string; expiresAt: string }>("/records/wallet/challenge", { method: "POST", body: JSON.stringify({ address }) }),
  verifyPaymentWallet: (body: { challengeId: string; signature: string }) =>
    request<{ ok: boolean; wallet_address: string; wallet_verified_at: string }>("/records/wallet/verify", { method: "POST", body: JSON.stringify(body) }),
  bindPaymentWallet: (address: string) =>
    request<{ ok: boolean; wallet_address: string; wallet_verified: boolean }>("/records/wallet", { method: "PUT", body: JSON.stringify({ address }) }),
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

  /** Unified Quick Pay dry preview (employee or ad-hoc address). */
  quoteQuickPayDry: (body: QuickPayQuoteTarget) =>
    request<{ dry: true; mode?: QuickPayMode; quote: QuickPayQuote }>("/payments/quick-pay/quote", {
      method: "POST",
      body: JSON.stringify({ ...body, dry: true }),
    }),

  /**
   * Unified Quick Pay live quote — ephemeral (no DB rows). Returns a signed context
   * token plus deposit details; persist via commitQuickPay after the on-chain deposit.
   */
  quoteQuickPay: (body: QuickPayQuoteTarget & { idempotencyKey: string }) =>
    request<{
      mode: QuickPayMode;
      context: string;
      intent?: { standard: "erc191"; payload: string } | null;
      funding?: PrivateFundingQuote;
      quote: QuickPayQuote;
    }>("/payments/quick-pay/quote", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /** Quick Pay dry preview for an employee (compat). */
  quoteEmployeePaymentDry: (employeeId: string, body: {
    originAsset: string;
    amount?: string;
    destinationToken?: string;
    destinationNetwork?: string;
    mode?: QuickPayMode;
    memo?: string | null;
  }) =>
    request<{ dry: true; mode?: QuickPayMode; quote: QuickPayQuote }>("/payments/quick-pay/quote", {
      method: "POST",
      body: JSON.stringify({ ...body, employeeId, dry: true }),
    }),

  /**
   * Quick Pay live quote for an employee (compat) — ephemeral (no DB rows).
   */
  quoteEmployeePayment: (employeeId: string, body: {
    originAsset: string;
    amount?: string;
    destinationToken?: string;
    destinationNetwork?: string;
    idempotencyKey: string;
    mode?: QuickPayMode;
    memo?: string | null;
  }) =>
    request<{
      mode: QuickPayMode;
      context: string;
      intent?: { standard: "erc191"; payload: string } | null;
      funding?: PrivateFundingQuote;
      quote: QuickPayQuote;
    }>("/payments/quick-pay/quote", {
      method: "POST",
      body: JSON.stringify({ ...body, employeeId }),
    }),

  /** Persist Quick Pay after wallet deposit (idempotent; safe for queue retries). */
  commitQuickPay: (body: { context: string; txHash: string; signature?: string }) =>
    request<{
      attempt: PaymentAttempt;
      reused: boolean;
      mode: QuickPayMode;
      outcome?: "unknown";
    }>("/payments/quick-pay/commit", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  commitBatchPayout: (body: {
    batchId: string;
    txHash: string;
    contractAddress: string;
    originToken: "USDC" | "USDT";
    items: Array<{ context: string }>;
  }) =>
    request<{
      batch: PaymentBatchSummary | Record<string, unknown>;
      attempts?: PaymentAttempt[];
      reused: boolean;
      outcome?: "unknown";
    }>("/payments/batch/commit", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listPaymentBatches: (params?: { page?: number; pageSize?: number }) => {
    const search = new URLSearchParams();
    if (params?.page) search.set("page", String(params.page));
    if (params?.pageSize) search.set("pageSize", String(params.pageSize));
    const qs = search.toString();
    return request<PaymentBatchListResult>(`/payments/batches${qs ? `?${qs}` : ""}`);
  },

  getPaymentBatch: (id: string) =>
    request<PaymentBatchDetailResult>(`/payments/batches/${id}`),

  listPendingPayments: () =>
    request<{ payments: PendingPaymentRow[] }>("/payments/pending"),

  reconcileOpenPayments: () =>
    request<{ checked: number; attempts: PaymentAttempt[] }>("/payments/reconcile", { method: "POST" }),
};
