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
| GET | `/api/org/employees/:id/payments` | `api.listEmployeePayments` |
| GET | `/api/org/pay-overview` | `api.payOverview` |
| POST | `/api/org/employees` | `api.createEmployee` |
| PATCH | `/api/org/employees/:id` | `api.updateEmployee` |
| DELETE | `/api/org/employees/:id` | `api.deleteEmployee` |

Types: `OrgInfo`, `OrgContext`, `TeamPaymentSchedule`, `TeamPaymentDateKey`, `Employee` in [`src/lib/api.ts`](../../src/lib/api.ts). Helpers: [`api/src/org-payment.ts`](../../api/src/org-payment.ts).

Callers: auth store (`orgContext`, `listEmployees`); legacy TeamPayouts / Settings / Overview. **`updateEmployee` / `deleteEmployee` have no current callers.**

Employee `status`: `pending` \| `ready` \| `update_required` — set by payout verification, **not** by admin PATCH `status`.

---

### GET /api/org/context

- **Auth** — admin \| employee
- **Source** — `api/src/routes/org.ts`
- **Client** — `api.orgContext` · callers: `stores/auth.ts`
- **Request** — none
- **Response** — `{ org: { id, name, country, payment_cadence, payment_date_key, reminder_lead_days, payment_configured_at }, memberCount, paymentConfigured, reminderLeadDefaults: { monthly, weekly } }`
- **Errors** — 404 org missing
- **Rules** — Minimal workspace context; no member directory. `paymentConfigured` is true when `payment_configured_at` is set (Create Team onboarding complete). Phase 1: single org via `user.org_id`. `reminderLeadDefaults` comes from env `REMINDER_LEAD_DAYS_MONTHLY` / `REMINDER_LEAD_DAYS_WEEKLY` (defaults 7 / 3).

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
- **Rules** — Writes org payment fields only; sets `reminder_lead_days` from env (`REMINDER_LEAD_DAYS_MONTHLY` / `REMINDER_LEAD_DAYS_WEEKLY`, defaults **7** / **3**); sets `payment_configured_at`. Does **not** create `payroll_runs` or `payroll_schedules`. Does not change org name. Audit `org.team_payment_updated`. Idempotent (may update preferences again).

---

### GET /api/org/pay-overview

- **Auth** — admin
- **Source** — `api/src/routes/org.ts` + `api/src/pay-period.ts`
- **Client** — `api.payOverview` · callers: `PayView`
- **Request** — none
- **Response** — period window, stats (`currentPayrollMinor`, `recipientsCount`, `toBePaidCount`, `paidCount`, `progress`), latest 6 `recipients`, `highPriority` payroll/verification alerts, `payStatuses` map
- **Rules** — Aggregates `employee_type = 'employee'` only against team schedule (`organizations.payment_*`) and `employee_payments`. Contractor cadence is deferred. Full To be paid / Paid / none algorithm: [`docs/pay-status.md`](../pay-status.md).
- **Errors** — 404 org; 409 `PAYMENT_NOT_CONFIGURED`

---

### GET /api/org/employees

- **Auth** — admin
- **Source** — `api/src/routes/org.ts`
- **Client** — `api.listEmployees`
- **Request** (query, all optional)

  | Param | Notes |
  |---|---|
  | `q` | Case-insensitive substring on name, email, endpoint |
  | `type` | `employee` \| `contractor` |
  | `periodKey` | `YYYY-MM` or `YYYY-Www`; scopes row `payStatus` |
  | `page` / `pageSize` | When either is set, response is paginated; omit both for full list (Quick Pay / drawers) |

- **Response** — `{ employees, total, page, pageSize, counts: { all, employees, contractors } }`
  - Row fields include: `payment_cadence`, `payment_date_key`, `payStatus`, `nextPayday`, `nextPaydayDisplay`
- **Rules** — Employees inherit team schedule; contractors use own cadence (`monthly`/`weekly`/`on_demand`). See [`docs/pay-status.md`](../pay-status.md).

---

### GET /api/org/employees/:id/payments

- **Auth** — admin
- **Client** — `api.listEmployeePayments`
- **Request** — `limit`, `cursor` (paid_at cursor)
- **Response** — `{ payments: [{ id, paid_at, amount_minor, token, network, period_key, txHash, explorerUrl }], nextCursor }`
- **Rules** — `status = paid` rows only; optional join to confirmed attempt `deposit_tx_hash`.

---

### POST /api/org/employees

- **Auth** — admin
- **Source** — `api/src/routes/org.ts`
- **Client** — `api.createEmployee`
- **Request**

  | Field | Type | Required | Notes |
  |---|---|---|---|
  | `name` | string | yes | |
  | `email` | string | yes | unique per org |
  | `employee_type` | `employee` \| `contractor` | no | default `employee` |
  | `role_title` | enum | no | `Developer` \| `Product` \| `Growth` \| `Finance` \| `Operations` |
  | `location` | string | no | |
  | `token` | string | no | default USDC |
  | `network` | string | no | default Base |
  | `endpoint` | string | no | EVM address or empty |
  | `amount` | string | no | decimal → `amount_minor`; default 0 |
  | `payment_cadence` | string | contractor | `monthly` \| `weekly` \| `on_demand` |
  | `payment_date_key` | string | if monthly/weekly | same keys as Create Team |

- **Response** — `201` `{ employee }` · `status=pending`
- **Errors** — 400 validation; 409 duplicate email
- **Rules** — Employees ignore personal cadence columns (stored null). Audit `employee.created`.

---

### PATCH /api/org/employees/:id

- **Auth** — admin
- **Source** — `api/src/routes/org.ts`
- **Client** — `api.updateEmployee`
- **Request** — any of create fields above — **not** `status`
- **Response** — `{ employee }`
- **Errors** — 400 if `status` sent / invalid fields; 409 duplicate email
- **Rules** — Changing token/network/endpoint → `status=update_required`, clears `payout_verified_at`. Switching to employee clears personal cadence.
- **Gotchas** — Admin cannot force `ready`; employee must re-verify via `/api/records/me/payout/*`.

---

### DELETE /api/org/employees/:id

- **Auth** — admin
- **Source** — `api/src/routes/org.ts`
- **Client** — `api.deleteEmployee`
- **Request** — path `id`
- **Response** — `{ ok: true }`
- **Errors** — 404 missing; 401/403
- **Rules** — Removes directory row (hard delete). If `user_id` set, unlinks `users.org_id` (sets null) so the account leaves the team. Keeps `employee_payments` history rows. Audit `employee.removed`.
