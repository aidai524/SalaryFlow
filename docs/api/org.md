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
- **Response** — `{ org: { id, name, country, payment_cadence, payment_date_key, reminder_lead_days, payment_configured_at }, memberCount, paymentConfigured }`
- **Errors** — 404 org missing
- **Rules** — Minimal workspace context; no member directory. `paymentConfigured` is true when `payment_configured_at` is set (Create Team onboarding complete). Phase 1: single org via `user.org_id`.

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
- **Rules** — Writes org payment fields only; sets `reminder_lead_days` to **7** (monthly) or **3** (weekly); sets `payment_configured_at`. Does **not** create `payroll_runs` or `payroll_schedules`. Does not change org name. Audit `org.team_payment_updated`. Idempotent (may update preferences again).

---

### GET /api/org/employees

- **Auth** — admin
- **Source** — `api/src/routes/org.ts`
- **Client** — `api.listEmployees`
- **Request** — none
- **Response** — `{ employees: Employee[] }` fields: `id, user_id, email, name, role_title, location, token, network, amount_minor, endpoint, status, payout_verified_at, last_paid_at, created_at`
- **Errors** — 401/403

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
  | `role_title` | string | no | |
  | `location` | string | no | |
  | `token` | string | no | default USDC |
  | `network` | string | no | default Base |
  | `endpoint` | string | no | EVM address or empty |
  | `amount` | string | no | decimal → `amount_minor`; default 0 |

- **Response** — `201` `{ employee }` · `status=pending`
- **Errors** — 400 validation; 409 duplicate email
- **Rules** — Pre-provision before invite accept; audit `employee.created`.

---

### PATCH /api/org/employees/:id

- **Auth** — admin
- **Source** — `api/src/routes/org.ts`
- **Client** — `api.updateEmployee` (**unused by UI**)
- **Request** — any of `email, name, role_title, location, token, network, endpoint, amount` — **not** `status`
- **Response** — `{ employee }`
- **Errors** — 400 if `status` sent / invalid fields; 409 duplicate email
- **Rules** — Changing token/network/endpoint → `status=update_required`, clears `payout_verified_at`.
- **Gotchas** — Admin cannot force `ready`; employee must re-verify via `/api/records/me/payout/*`.

---

### DELETE /api/org/employees/:id

- **Auth** — admin
- **Source** — `api/src/routes/org.ts`
- **Client** — `api.deleteEmployee` (**unused by UI**)
- **Request** — path `id`
- **Response** — `{ ok: true }`
- **Errors** — 401/403
- **Rules** — Hard delete. No FK cleanup documented here — check DB constraints before calling from new UI.
