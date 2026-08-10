# Payments API

Parent index: [`docs/api.md`](../api.md)

| Module | Path |
|---|---|
| Routes | [`api/src/routes/payments.ts`](../../api/src/routes/payments.ts) |
| Live gate / asset map | [`api/src/payment-state.ts`](../../api/src/payment-state.ts) |
| Reconcile / attempt IO | [`api/src/payment-execution.ts`](../../api/src/payment-execution.ts) |
| 1Click client (internal) | [`api/src/intents.ts`](../../api/src/intents.ts) |
| Frontend orchestration | [`src/lib/payment.ts`](../../src/lib/payment.ts) |
| UI | [`src/components/PayDialog.tsx`](../../src/components/PayDialog.tsx) |

## Domain index

| Method | Path | Client |
|---|---|---|
| POST | `/api/payments/quote` | `api.quote` (forces `dry: true`) |
| POST | `/api/payments/items/:itemId/quote` | `api.quotePaymentItem` |
| POST | `/api/payments/attempts/:attemptId/intent` | `api.generatePaymentIntent` |
| POST | `/api/payments/attempts/:attemptId/submit` | `api.submitPaymentAttempt` |
| POST | `/api/payments/attempts/:attemptId/reconcile` | `api.reconcilePaymentAttempt` |
| POST | `/api/payments/reconcile` | — |
| POST | `/api/payments/runs/:runId/reopen-failed` | `api.reopenFailedPayments` |
| GET | `/api/payments/runs/:runId/attempts` | `api.listPaymentAttempts` |
| POST | `/api/payments/generate-intent` | — **deprecated** always 409 |
| POST | `/api/payments/submit-intent` | — **deprecated** always 409 |
| POST | `/api/payments/status` | — **deprecated** always 409 |

## Live gate

`executionGate(env)` in `payment-state.ts` + `INTENTS_API_KEY` required for all live attempt routes.

| Condition | Code | Status |
|---|---|---|
| `PAYMENTS_MODE` not `live` | `LIVE_PAYMENTS_DISABLED` | 409 |
| Invalid / non-official provider URL | `INVALID_PROVIDER_URL` | 503 |
| Missing `PAYMENTS_EXECUTION_ACK` | `LIVE_ACK_REQUIRED` | 503 |
| Missing `INTENTS_API_KEY` | `PAYMENT_PROVIDER_NOT_CONFIGURED` | 503 |

Local default should stay dry-run. Do not wire deprecated routes.

## Attempt state machine

```text
created → quoting → quoted → generating → awaiting_signature
  → submitting → submitted → processing → confirmed | failed | refunded
```

Frontend type `PaymentAttemptState` matches. Backend `PaymentAttemptRow` also has `quote_response`, `quote_hash`, `intent_payload`, timestamps — **returned but not fully typed** on client `PaymentAttempt`.

## Failure matrix (high-frequency)

| Code | Status | Fix |
|---|---|---|
| `PAYMENTS_DISABLED` | 503 | Set `PAYMENTS_MODE` to `dry-run` or `live` |
| `LIVE_PAYMENTS_DISABLED` | 409 | For `/quote` send `dry: true`; for live fix gate env |
| `DRY_RUN_VALIDATION_FAILED` | 422 | Read `issues[]`; fix employee payout |
| `PAYMENT_WALLET_NOT_VERIFIED` | 422 | Admin `/records/wallet/challenge` + `verify` |
| `IDEMPOTENCY_KEY_CONFLICT` | 409 | New key per item |
| `ACTIVE_ATTEMPT_EXISTS` | 409 | Reuse or wait; body may include `attempt` |
| `QUOTE_EXPIRED` | 409 | New item quote (new attempt) |
| `PAYMENT_WALLET_CHANGED` | 409 | Re-bind signer matching attempt |
| `PAYMENT_PROVIDER_ERROR` | 502 | Inspect `detail`; check 1Click / asset map |
| `PAYMENT_SUBMIT_REJECTED` | 409 | Item reopened to pending; requote |
| submit `202` + `outcome: "unknown"` | 202 | Reconcile; not a hard fail |

### Payable item issue codes (`issues[].code`)

| Code | Meaning |
|---|---|
| `UNLINKED_EMPLOYEE` | Item has no `employee_id` |
| `PAYOUT_NOT_READY` | Employee `status !== ready` |
| `PAYOUT_NOT_VERIFIED` | Missing `payout_verified_at` |
| `INVALID_PAYOUT_ADDRESS` | Bad EVM endpoint |
| `PAYOUT_DETAILS_CHANGED` | Item token/network ≠ employee |
| `UNSUPPORTED_TOKEN` / `UNSUPPORTED_NETWORK` | Enum mismatch |
| `INVALID_AMOUNT` | Non-positive / unsafe integer minor |

---

### POST /api/payments/quote

- **Auth** — admin
- **Source** — `payments.ts` (local only; **never** calls 1Click)
- **Client** — `api.quote({ runId, dry: true })`
- **Request** — `{ runId: string, dry: true }` — any non-true `dry` → 409 `LIVE_PAYMENTS_DISABLED`
- **Response** — `200` `{ dry: true, mode: "dry-run", executionAllowed: false, itemCount, validatedItemCount, checkedAt, totals: { usdcMinor, usdtMinor } }`
- **Errors** — 503 `PAYMENTS_DISABLED`; 400 no pending/failed items; 422 `DRY_RUN_VALIDATION_FAILED` + `issues`; 404 run
- **Rules** — Validates pending+failed items only. Audit `payment.dry_run`.
- **Gotchas** — Client success type omits `issues`; on 422 use `ApiError` only (extra JSON lost unless raw fetch).

---

### POST /api/payments/items/:itemId/quote

- **Auth** — admin + **verified payment wallet**
- **Source** — `payments.ts` + `intents.requestQuote` / `verifyOneClickQuote`
- **Client** — `api.quotePaymentItem(itemId, idempotencyKey)` · `src/lib/payment.ts`
- **Request** — path `itemId`; body `{ idempotencyKey }` — `^[A-Za-z0-9._:-]{16,128}$`
- **Response** — `201` `{ attempt, reused: false }` or `200` `{ attempt, reused: true }` when same key+item
- **Errors** — live gate; 422 wallet/payout/precision; 409 idempotency/active attempt/`ITEM_NOT_PENDING`; 503 asset map; 502 provider
- **Rules** — Creates `payment_attempts` + `chain_records`; moves item/run toward processing. Idempotent on key.
- **Gotchas** — Requires admin `wallet_verified`. Failed items can be re-quoted after reopen / fail path.

---

### POST /api/payments/attempts/:attemptId/intent

- **Auth** — admin
- **Client** — `api.generatePaymentIntent`
- **Request** — path `attemptId`
- **Response** — `{ attempt, intent: { standard: "erc191", payload: string }, reused }`
- **Errors** — 409 wallet changed / wrong state / `QUOTE_EXPIRED` / `ATTEMPT_STATE_CONFLICT`; 502 provider
- **Rules** — From `quoted` → `generating` → `awaiting_signature`. Reuses stored intent if already past generate.
- **Gotchas** — Client must sign `intent.payload` with the admin wallet (same address as `signer_id`).

---

### POST /api/payments/attempts/:attemptId/submit

- **Auth** — admin
- **Client** — `api.submitPaymentAttempt(attemptId, signature)`
- **Request** — `{ signature }` — `0x` + 130 hex (65-byte)
- **Response** — `200` `{ attempt, reused }` · `202` `{ attempt, outcome: "unknown", reused: false }` · reuse if already submitted+
- **Errors** — 400 bad/mismatched signature; 409 state / wallet / `PAYMENT_SUBMIT_REJECTED` (+ `detail`, `attempt`, `outcome: "failed"`); 500 invalid stored intent
- **Rules** — Verifies ERC-191 against `signer_id`, submits to 1Click. Definitive reject → fail attempt + reopen item pending.
- **Gotchas** — `202 unknown` schedules reconcile; UI should poll reconcile, not treat as success/fail.

---

### POST /api/payments/attempts/:attemptId/reconcile

- **Auth** — admin
- **Client** — `api.reconcilePaymentAttempt`
- **Request** — path only
- **Response** — `{ attempt, reused }` — terminal states return reused
- **Errors** — 409 if state not submitting/submitted/processing; live gate
- **Rules** — `force: true` (skips cron lock). Updates item + chain_records + run status.

---

### POST /api/payments/reconcile

- **Auth** — admin
- **Client** — — (no frontend method)
- **Response** — `{ checked, attempts }` from `reconcileOpenPayments(env, 1)`
- **Rules** — Same as cron batch size 1. No-op if live gate closed.

---

### POST /api/payments/runs/:runId/reopen-failed

- **Auth** — admin
- **Client** — `api.reopenFailedPayments`
- **Response** — `{ ok: true, reopened: number }`
- **Rules** — Failed items → `pending` (clears deposit/intent timestamps); run → `ready`.

---

### GET /api/payments/runs/:runId/attempts

- **Auth** — admin
- **Client** — `api.listPaymentAttempts`
- **Response** — `{ attempts: PaymentAttemptRow[] }` (full DB rows)
- **Errors** — 404 run

---

### POST /api/payments/generate-intent · submit-intent · status

- **Auth** — admin
- **Client** — none — **do not wire**
- **Response** — always `409` `{ code: "LIVE_PAYMENTS_DISABLED", ... }`
- **Rules** — Legacy stubs. Live execution must use persisted `attemptId` routes above.
