# Payroll API

Parent index: [`docs/api.md`](../api.md) · Source: [`api/src/routes/payroll.ts`](../../api/src/routes/payroll.ts) · Schedules: [`api/src/payroll-schedule.ts`](../../api/src/payroll-schedule.ts)

## Domain index

| Method | Path | Client |
|---|---|---|
| GET | `/api/payroll` | `api.listRuns` |
| POST | `/api/payroll` | `api.createRun` |
| GET | `/api/payroll/schedules` | `api.listPayrollSchedules` |
| PATCH | `/api/payroll/schedules/:id` | `api.updatePayrollSchedule` |
| DELETE | `/api/payroll/schedules/:id` | `api.archivePayrollSchedule` |
| GET | `/api/payroll/:id` | `api.getRun` |
| POST | `/api/payroll/:id/items/import` | `api.importPayrollItems` |
| POST | `/api/payroll/:id/items` | `api.addItem` |
| PATCH | `/api/payroll/:id/items/:itemId` | `api.updatePayrollItem` |
| DELETE | `/api/payroll/:id/items/:itemId` | `api.removePayrollItem` |
| PATCH | `/api/payroll/:id` | `api.updateRun` / `api.setRunStatus` |
| DELETE | `/api/payroll/:id` | `api.archiveRun` |

Types: `PayrollRun`, `PayrollSchedule`, `PayrunItem`, `PayrollImportRow`, `PayrollCadence` in [`src/lib/api.ts`](../../src/lib/api.ts).

Callers: none on the current router. Client methods remain in [`src/lib/api.ts`](../../src/lib/api.ts); Worker cron still materializes schedules.

**Cron** — Worker scheduled job calls `materializePayrollSchedules` (draft runs only; never pays).

**Cadence** — `manual` \| `weekly` \| `biweekly` \| `monthly`.

**Run status (manual)** — Admin may only set `draft` \| `ready`. Processing/terminal states come from payment attempts.

---

### GET /api/payroll

- **Auth** — admin
- **Client** — `api.listRuns`
- **Response** — `{ runs: PayrollRun[] }` with `itemCount`, `usdcMinor`, `usdtMinor`, `cadence`, `schedule_id`, `source`
- **Rules** — Excludes archived runs.

---

### POST /api/payroll

- **Auth** — admin
- **Client** — `api.createRun`
- **Request** — `{ label, payDate?, cadence? }` — `payDate` default today (`YYYY-MM-DD`); `cadence` required/normalized
- **Response** — `201` `{ run }` status `draft`
- **Errors** — 400 missing label / bad date / bad cadence
- **Rules** — Non-manual cadence also inserts `payroll_schedules` and labels run as `{label} · {payDate}`; `source=schedule`.

---

### GET /api/payroll/schedules

- **Auth** — admin
- **Client** — `api.listPayrollSchedules`
- **Response** — `{ schedules }` with boolean `active`
- **Rules** — Schedules only create drafts; never execute payment.

---

### PATCH /api/payroll/schedules/:id

- **Auth** — admin
- **Client** — `api.updatePayrollSchedule`
- **Request** — `{ name?, cadence?, nextPayDate?, active? }` — cadence must be recurring (not manual)
- **Response** — `{ schedule }`
- **Errors** — 404; 400 validation

---

### DELETE /api/payroll/schedules/:id

- **Auth** — admin
- **Client** — `api.archivePayrollSchedule`
- **Response** — `{ ok: true, archivedAt }`
- **Rules** — Soft archive (`active=0`, `archived_at`).

---

### GET /api/payroll/:id

- **Auth** — admin
- **Client** — `api.getRun`
- **Response** — `{ run, items }` — each item may include latest attempt summary: `payment_attempt_id`, `payment_state`, `provider_status`
- **Errors** — 404

---

### POST /api/payroll/:id/items/import

- **Auth** — admin
- **Client** — `api.importPayrollItems`
- **Request** — `{ rows: PayrollImportRow[] }` — also accepts `employee_email` / `employee_name` snake_case
- **Response** — `201` `{ ok, importedCount, linkedCount, manualCount }`
- **Errors**

  | Status | Code | When |
  |---|---|---|
  | 400 | — | run not draft / empty / >200 rows |
  | 400 | `PAYROLL_IMPORT_INVALID` | row errors in `errors: [{ row, field, message }]` |
  | 404 | — | run missing |

- **Rules** — Email links to employee (token/network must match employee). Blank email → manual unpayable name row. Max 200 rows. Atomic batch insert.
- **Gotchas** — CSV row numbers in errors are 1-indexed + header (`row: index+2`).

---

### POST /api/payroll/:id/items

- **Auth** — admin
- **Client** — `api.addItem`
- **Request** — `{ employeeId?, employeeName?, amount?, token?, network? }`
- **Response** — `201` `{ item }`
- **Errors** — 400 not draft / amount; 404 run/employee; 409 duplicate recipient
- **Rules** — Linked employee pulls name/token/network defaults and syncs `employees.amount_minor` on add. Manual needs `employeeName` + positive amount.

---

### PATCH /api/payroll/:id/items/:itemId

- **Auth** — admin
- **Client** — `api.updatePayrollItem`
- **Request** — `{ employeeId?, employeeName?, amount?, token?, network? }` — `employeeId` key present with empty clears link
- **Response** — `{ item }`
- **Errors** — 409 if run not draft / item not pending / has attempts; 404; 400 validation
- **Rules** — Linked employee forces token/network from profile; syncs employee amount defaults.

---

### DELETE /api/payroll/:id/items/:itemId

- **Auth** — admin
- **Client** — `api.removePayrollItem`
- **Response** — `{ ok: true, removedAt }`
- **Errors** — 409 if not draft / not pending / has attempts
- **Rules** — Soft remove (`removed_at`).

---

### PATCH /api/payroll/:id

- **Auth** — admin
- **Client** — `api.updateRun` · `api.setRunStatus` (wrapper; **unused**)
- **Request** — `{ label?, payDate?, status?: "draft"|"ready" }`
- **Response** — `{ run }`
- **Errors** — 409 editing metadata when not draft or has attempts; 400 invalid status / processing state; 409 schedule pay-date conflict
- **Rules** — Cannot manually set processing/paid/failed/partial.

---

### DELETE /api/payroll/:id

- **Auth** — admin
- **Client** — `api.archiveRun`
- **Response** — `{ ok: true, archivedAt }`
- **Errors** — 409 if not draft or has payment attempts
- **Rules** — Soft archive only.
