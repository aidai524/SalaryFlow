# Org / Employees API

Parent index: [`docs/api.md`](../api.md) · Source: [`api/src/routes/org.ts`](../../api/src/routes/org.ts) · Payout helpers: [`api/src/payout.ts`](../../api/src/payout.ts)

## Domain index

| Method | Path | Client |
|---|---|---|
| GET | `/api/org/context` | `api.orgContext` |
| GET | `/api/org` | `api.org` |
| PATCH | `/api/org` | `api.updateOrg` |
| PATCH | `/api/org/team` | `api.updateTeam` |
| GET | `/api/org/employees` | `api.listEmployees` |
| GET | `/api/org/employees/:id` | `api.getEmployee` |
| GET | `/api/org/employees/:id/payments` | `api.listEmployeePayments` |
| GET | `/api/org/pay-overview` | `api.payOverview` |
| GET | `/api/org/overview` | `api.orgOverview` |
| GET | `/api/org/payments` | `api.listOrgPayments` |
| POST | `/api/org/employees` | `api.createEmployee` |
| PATCH | `/api/org/employees/:id` | `api.updateEmployee` |
| DELETE | `/api/org/employees/:id` | `api.deleteEmployee` |

Types: `OrgInfo`, `OrgContext`, `TeamPaymentSchedule`, `TeamPaymentDateKey`, `Employee` in [`src/lib/api.ts`](../../src/lib/api.ts). Helpers: [`api/src/org-payment.ts`](../../api/src/org-payment.ts).

Callers: [`src/stores/auth.ts`](../../src/stores/auth.ts) (`orgContext`); [`CreateTeamView`](../../src/views/admin/CreateTeamView.tsx); Recipients / Pay / Overview / Payment History views via `src/hooks/use-*-api.ts`.

Employee `status`: `pending` \| `ready` \| `update_required` — set by payout verification, **not** by admin PATCH `status`.

---

### GET /api/org/context

- **Auth** — admin \| employee
- **Source** — `api/src/routes/org.ts`
- **Client** — `api.orgContext` · callers: `stores/auth.ts`
- **Request** — none
- **Response** — `{ org: { id, name, country, payment_cadence, payment_date_key, reminder_lead_days, payment_configured_at }, memberCount, attentionCount, paymentConfigured }`
- **Errors** — 404 org missing
- **Rules** — Minimal workspace context; no member directory. `paymentConfigured` is true when `payment_configured_at` is set (Create Team onboarding complete). `attentionCount` is `COUNT(employees WHERE status != 'ready')` for admin, `0` for employee. Phase 1: single org via `user.org_id`. Column `reminder_lead_days` is legacy (unused; may be null).

---

### GET /api/org

- **Auth** — admin
- **Source** — `api/src/routes/org.ts`
- **Client** — `api.org`
- **Request** — none
- **Response** — `OrgInfo`: `{ org: { id, name, country, created_at }, members: [...], pendingInvites }`
- **Errors** — 401/403
- **Gotchas** — Member `wallet_address` is the **user** payment/payout wallet field on `users`, not employee endpoint.

---

### PATCH /api/org

- **Auth** — admin
- **Source** — `api/src/routes/org.ts`
- **Client** — `api.updateOrg`
- **Request** — `{ name?: string, country?: string }` (`country` empty → null)
- **Response** — `{ org }`
- **Errors** — 400 empty name / nothing to update
- **Rules** — Audit `org.updated`.

---

### PATCH /api/org/team

- **Auth** — admin
- **Source** — `api/src/routes/org.ts`
- **Client** — `api.updateTeam` · callers: Create Team view
- **Request**

  | Field | Type | Required | Notes |
  |---|---|---|---|
  | `paymentSchedule` | `monthly` \| `weekly` | yes | |
  | `paymentDate` | string key | yes | Must match schedule (see below) |

  Monthly `paymentDate`: `every_1st` \| `every_15th` \| `every_end_of_month`  
  Weekly `paymentDate`: `every_monday` … `every_sunday`

- **Response** — `{ org: { id, name, country, payment_cadence, payment_date_key, reminder_lead_days, payment_configured_at } }`
- **Errors** — 400 invalid schedule / date / mismatch
- **Rules** — Writes org payment fields only; sets `reminder_lead_days = NULL`; sets `payment_configured_at`. Does **not** create `payroll_runs` or `payroll_schedules`. Does not change org name. Audit `org.team_payment_updated`. Idempotent (may update preferences again).

---

### GET /api/org/pay-overview

- **Auth** — admin
- **Source** — `api/src/routes/org.ts` + `api/src/pay-period.ts`
- **Client** — `api.payOverview` · callers: `PayView`
- **Request** — none
- **Response** — period window (`periodKey`, `payday`, `paydayDisplay`, `cadence`, `monthLabel`), stats (`currentPayrollMinor`, `recipientsCount`, `progress`), latest 6 `recipients`, `highPriority.verification`
- **Rules** — Aggregates `employee_type = 'employee'` only against team schedule (`organizations.payment_*`) and `employee_payments`. `periodKey` = natural calendar month/week of today; `payday` / `paydayDisplay` = next scheduled payday on/after today (`resolveUpcomingPayday`). `progress` = share of employees with a `status=paid` payment for the current `periodKey`. Contractor cadence is deferred.
- **Errors** — 404 org; 409 `PAYMENT_NOT_CONFIGURED`

---

### GET /api/org/overview

- **Auth** — admin
- **Source** — `api/src/routes/org.ts` + `api/src/pay-period.ts`
- **Client** — `api.orgOverview` · callers: `OverviewView`
- **Request** (query)

  | Param | Notes |
  |---|---|
  | `periodKey` | Optional. `YYYY-MM` or `YYYY-Www` matching team cadence; default = current natural calendar period |
  | `volumeRange` | `6` \| `12` (default `6`) — number of past periods for Payment Volume |

- **Response** — `period` (includes `currentPeriodKey`, `nextPayday` / `nextPaydayDisplay`), `stats` (`paidMinor`, `paidCount`, `awaitingMinor`, `awaitingCount`, `daysLeft`, `progress`, `recipientsCount`), `volume.bars[]`, `upcoming[]` (current + next 3 unpaid employee payrolls), `recentPayments` (latest 5 paid/processing), `category` (employee vs contractor headcount), `networks` (payout network distribution)
- **Rules** — `period_key` buckets are natural calendar months/weeks (payment date), not payday roll-forward. Selected period’s `payday` is the scheduled date within that period. Next Payment Day (`nextPayday` / `nextPaydayDisplay`) is the scheduled payday of the **next** period after the selected one. `daysLeft` is whole UTC days until that next payday; the Overview subtitle shows `"N Days Left"` only when `daysLeft > 0` (hidden for today or past dates). Dashboard money/progress counts `employee_type = 'employee'` only. Category / networks use full directory.
- **Errors** — 400 invalid `periodKey`; 404 org; 409 `PAYMENT_NOT_CONFIGURED`

---

### GET /api/org/payments

- **Auth** — admin
- **Source** — `api/src/routes/org.ts`
- **Client** — `api.listOrgPayments` · callers: `PaymentHistoryView`
- **Request** (query)

  | Param | Notes |
  |---|---|
  | `periodKey` | Optional; default current period |
  | `q` | Case-insensitive substring on employee name |

- **Response** — `{ org, period, payments: [{ id, employeeId (nullable for ad-hoc address pay), name, role_title, employee_type, amount_minor, token, network, status, paid_at, period_key, memo }] }`
- **Rules** — All payment statuses for the period; UI maps `processing` → Pending.
- **Errors** — 400 invalid `periodKey`; 404 org; 409 `PAYMENT_NOT_CONFIGURED`

---

### GET /api/org/employees

- **Auth** — admin
- **Source** — `api/src/routes/org.ts`
- **Client** — `api.listEmployees`
- **Request** (query, all optional)

  | Param | Notes |
  |---|---|
  | `q` | Case-insensitive substring on name, email, endpoint |
  | `type` | `employee` \| `contractor` \| `others` |
  | `page` / `pageSize` | When either is set, response is paginated; omit both for full list |
  | `sort` | Omit for `created_at DESC`. `last_paid` = `last_paid_at DESC` (nulls last); used by Quick Pay capsules |

- **Response** — `{ employees, total, page, pageSize, counts: { all, employees, contractors } }`
  - Row fields include: `payment_cadence`, `payment_date_key`, `nextPayday`, `nextPaydayDisplay`
- **Rules** — Employees inherit team schedule; contractors use own cadence (`monthly`/`weekly`/`on_demand`). Period helpers: [`api/src/pay-period.ts`](../../api/src/pay-period.ts).

---

### GET /api/org/employees/:id

- **Auth** — admin
- **Client** — `api.getEmployee`
- **Response** — `{ employee }` — same enriched shape as list rows (`payment_cadence`, `payment_date_key`, `nextPayday`, `nextPaydayDisplay`)
- **Errors** — 404 not found
- **Rules** — Fresh single-row read for edit dialogs; employees inherit team schedule.

---

### GET /api/org/employees/:id/payments

- **Auth** — admin
- **Client** — `api.listEmployeePayments`
- **Request** — `limit`, `cursor` (paid_at cursor)
- **Response** — `{ payments: [{ id, paid_at, amount_minor, token, network, period_key, status, memo, txHash, explorerUrl }], nextCursor }`
- **Rules** — `status = paid` rows only; optional join to confirmed attempt `destination_tx_hash` (employee receive/settlement tx on destination chain, not admin funding/deposit).

---

### POST /api/org/employees

- **Auth** — admin
- **Source** — `api/src/routes/org.ts`
- **Client** — `api.createEmployee`
- **Request**

  | Field | Type | Required | Notes |
  |---|---|---|---|
  | `name` | string | yes | |
  | `email` | string | employee yes; else no | unique per org when set; non-employee may be null |
  | `employee_type` | `employee` \| `contractor` \| `others` | no | default `employee` |
  | `role_title` | enum | no | `Developer` \| `Product` \| `Growth` \| `Finance` \| `Operations` |
  | `location` | string | no | |
  | `token` | string | no | default USDC |
  | `network` | string | no | default Base |
  | `endpoint` | string | non-employee yes | EVM address; optional for employee |
  | `amount` | string | employee yes (>0); else no | decimal → `amount_minor`; non-employee default 0 |
  | `payment_cadence` | string | no | non-employee: `monthly` \| `weekly` \| `on_demand` (default `on_demand` if omitted) |
  | `payment_date_key` | string | if monthly/weekly | same keys as Create Team; null for `on_demand` |

- **Response** — `201` `{ employee }` · `status=pending`
- **Errors** — 400 validation; 409 duplicate email
- **Rules** — Employees ignore personal cadence columns (stored null). Non-employee email/schedule/amount are optional. Audit `employee.created`.

---

### PATCH /api/org/employees/:id

- **Auth** — admin
- **Source** — `api/src/routes/org.ts`
- **Client** — `api.updateEmployee`
- **Request** — any of create fields above — **not** `status`
- **Response** — `{ employee }`
- **Errors** — 400 if `status` sent / invalid fields; 409 duplicate email
- **Rules** — Changing token/network/endpoint **to a different value** → `status=update_required`, clears `payout_verified_at`. Unchanged payout fields do not reset verification. Switching to employee clears personal cadence and requires email + amount > 0. Non-employee may clear email (`null` / `""`).
- **Gotchas** — Admin cannot force `ready`; employee must re-verify via `/api/records/me/payout/*`. Endpoint compare is case-insensitive.

---

### DELETE /api/org/employees/:id

- **Auth** — admin
- **Source** — `api/src/routes/org.ts`
- **Client** — `api.deleteEmployee`
- **Request** — path `id`
- **Response** — `{ ok: true }`
- **Errors** — 404 missing; 401/403
- **Rules** — Removes directory row (hard delete). If `user_id` set, unlinks `users.org_id` (sets null) so the account leaves the team. Keeps `employee_payments` history rows. Audit `employee.removed`.
