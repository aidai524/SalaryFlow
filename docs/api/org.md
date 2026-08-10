# Org / Employees API

Parent index: [`docs/api.md`](../api.md) · Source: [`api/src/routes/org.ts`](../../api/src/routes/org.ts) · Payout helpers: [`api/src/payout.ts`](../../api/src/payout.ts)

## Domain index

| Method | Path | Client |
|---|---|---|
| GET | `/api/org/context` | `api.orgContext` |
| GET | `/api/org` | `api.org` |
| PATCH | `/api/org` | `api.updateOrg` |
| GET | `/api/org/employees` | `api.listEmployees` |
| POST | `/api/org/employees` | `api.createEmployee` |
| PATCH | `/api/org/employees/:id` | `api.updateEmployee` |
| DELETE | `/api/org/employees/:id` | `api.deleteEmployee` |

Types: `OrgInfo`, `Employee` in [`src/lib/api.ts`](../../src/lib/api.ts).

Callers: auth store (`orgContext`, `listEmployees`); legacy TeamPayouts / Settings / Overview. **`updateEmployee` / `deleteEmployee` have no current callers.**

Employee `status`: `pending` \| `ready` \| `update_required` — set by payout verification, **not** by admin PATCH `status`.

---

### GET /api/org/context

- **Auth** — admin \| employee
- **Source** — `api/src/routes/org.ts`
- **Client** — `api.orgContext` · callers: `stores/auth.ts`
- **Request** — none
- **Response** — `{ org: { id, name, country }, memberCount }`
- **Errors** — 404 org missing
- **Rules** — Minimal workspace context; no member directory.

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
