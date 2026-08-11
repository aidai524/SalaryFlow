# Payments API

Parent index: [`docs/api.md`](../api.md)

| Module | Path |
|---|---|
| Routes | [`api/src/routes/payments.ts`](../../api/src/routes/payments.ts) |
| Quick Pay context token | [`api/src/quick-pay-context.ts`](../../api/src/quick-pay-context.ts) |
| Live gate / asset map | [`api/src/payment-state.ts`](../../api/src/payment-state.ts) |
| Reconcile / attempt IO | [`api/src/payment-execution.ts`](../../api/src/payment-execution.ts) |
| 1Click client (internal) | [`api/src/intents.ts`](../../api/src/intents.ts) |
| Frontend commit queue | [`src/stores/quick-pay-commit-queue.ts`](../../src/stores/quick-pay-commit-queue.ts) |
| UI | [`src/components/quick-pay/QuickPayPanel.tsx`](../../src/components/quick-pay/QuickPayPanel.tsx) |

## Domain index

| Method | Path | Client |
|---|---|---|
| POST | `/api/payments/quote` | `api.quote` (forces `dry: true`) |
| POST | `/api/payments/items/:itemId/quote` | `api.quotePaymentItem` (**legacy** payroll-run path) |
| POST | `/api/payments/quick-pay/quote` | `api.quoteQuickPay` / `quoteQuickPayDry` (`employeeId` **or** `destinationAddress`; optional `memo`) |
| POST | `/api/payments/employees/:employeeId/quote` | `api.quoteEmployeePayment` / `quoteEmployeePaymentDry` (compat wrapper → same handler) |
| POST | `/api/payments/quick-pay/commit` | `api.commitQuickPay` (persist after on-chain deposit; writes `employee_payments.memo`) |
| POST | `/api/payments/attempts/:attemptId/intent` | `api.generatePaymentIntent` (**legacy**) |
| POST | `/api/payments/attempts/:attemptId/submit` | `api.submitPaymentAttempt` (**legacy**) |
| POST | `/api/payments/attempts/:attemptId/reconcile` | `api.reconcilePaymentAttempt` |
| GET | `/api/payments/pending` | `api.listPendingPayments` (Pending Payments dock) |
| POST | `/api/payments/reconcile` | `api.reconcileOpenPayments` |
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

Legacy Confidential Intents (embedded) path / private leg B submit:

```text
created → quoting → quoted → generating → awaiting_signature
  → submitting → submitted → processing → confirmed | failed | refunded
```

Quick Pay **standard** (foreign-to-foreign `ORIGIN_CHAIN` + `confidentiality`):

Live quote returns an HMAC `context` token only (no DB). After the wallet deposit, `POST /quick-pay/commit` inserts rows already in `deposit_submitted`:

```text
(no rows until commit)
  → deposit_submitted → processing → confirmed | failed | refunded
```

Quick Pay **private** (default — EOA → confidential intents → employee, pre-signed):

Live quote chains payout quote + `generateIntent` + funding quote into `context` (no DB). Commit inserts at `funding_deposit_submitted`:

```text
(no rows until commit)
  → funding_deposit_submitted → funding_processing
  → submitted → processing → confirmed | failed | refunded
```

On funding `SUCCESS`, cron / reconcile auto-calls `submit-intent` with the stored ERC-191 signature, then tracks the payout deposit address. Frontend type `PaymentAttemptState` still includes pre-commit states for legacy/history. Quick Pay rows set `employee_payment_id` and may leave `run_id` / `item_id` null. `payment_attempts.flow` is `private` or `standard`.

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
| `QUICK_PAY_CONTEXT_INVALID` | 400 | Permanent — drop commit queue item |
| `QUICK_PAY_CONTEXT_EXPIRED` | 409 | Permanent — context older than 24h |
| `QUICK_PAY_CONTEXT_ORG_MISMATCH` / `QUICK_PAY_CONTEXT_SIGNER_MISMATCH` | 403 | Hold in queue until original account/wallet |
| `QUICK_PAY_SIGNATURE_INVALID` | 400 | Permanent — private ERC-191 signature bad |
| `QUICK_PAY_COMMIT_FAILED` | 500 | Temporary — retry commit |
| submit/commit `202` + `outcome: "unknown"` | 202 | Reconcile; not a hard fail |

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
- **Rules** — **Legacy** payroll-run path. Still uses `CONFIDENTIAL_INTENTS` + `INTENTS_ASSET_MAP`. Prefer Quick Pay employee quote for new UI.
- **Gotchas** — Requires admin `wallet_verified`. Failed items can be re-quoted after reopen / fail path.

---

### POST /api/payments/employees/:employeeId/quote

- **Auth** — admin + **verified payment wallet** (live path)
- **Source** — `payments.ts` + dynamic `/v0/tokens` via `api/src/assets.ts` + `quick-pay-context.ts`
- **Client** — `api.quoteEmployeePaymentDry` (`dry: true`) · `api.quoteEmployeePayment` (live)
- **Request** — `{ originAsset, amount?, destinationToken?, destinationNetwork?, idempotencyKey?, dry?, mode? }` — `mode` defaults to `private` (`standard` keeps F2F)
- **Response (dry, standard)** — `{ dry: true, mode, quote: { amountIn, amountOut, … } }`
- **Response (dry, private)** — chained dry quotes: payout (`CONFIDENTIAL_INTENTS` → dest) then funding (`ORIGIN_CHAIN` → confidential). `quote.amountIn` is the funding (You Pay) amount.
- **Response (live, standard)** — `200` `{ mode, context, quote }` — **no DB write**; `context` is HMAC-signed (24h TTL)
- **Response (live, private)** — `200` `{ mode, context, intent, funding, quote }` — chains payout quote + `generateIntent` + funding quote into `context` (no DB)
- **Rules** — Cancelling wallet sign/transfer leaves zero rows. Persist only via `/quick-pay/commit` after on-chain deposit. Private confidential origin = selected `originAsset`. Standard uses `INTENTS_CONFIDENTIALITY` (default `advanced`).
- **Errors** — 422 payout/token; live gate on non-dry; 502 provider

---

### POST /api/payments/quick-pay/commit

- **Auth** — admin + **verified payment wallet**
- **Client** — `api.commitQuickPay({ context, txHash, signature? })` · queued by `src/stores/quick-pay-commit-queue.ts`
- **Request** — `{ context, txHash, signature? }` — `txHash` = `0x` + 64 hex; private mode requires `signature` (`0x` + 130 hex)
- **Response** — `200` `{ attempt, reused, mode }` · `202` `{ attempt, outcome: "unknown", … }` if 1Click deposit notify fails but rows are stored
- **Rules** — Verifies HMAC context (24h) + org/signer match; private verifies ERC-191. Idempotent on `idempotency_key` (`reused: true`). Inserts `employee_payments` + `payment_attempts` + `chain_records` in one batch: standard → `deposit_submitted`, private → `funding_deposit_submitted`. Then notifies 1Click `/v0/deposit/submit` (non-fatal). Quote deadline is **not** a commit reject — reconcile decides confirmed/refunded.
- **Errors** — `QUICK_PAY_CONTEXT_*` / `QUICK_PAY_SIGNATURE_INVALID` (client: permanent vs hold); 500 `QUICK_PAY_COMMIT_FAILED` (retry); live gate

---

### GET /api/payments/pending

- **Auth** — admin
- **Client** — `api.listPendingPayments`
- **Response** — `{ payments: [{ attemptId, flow, state, token, network, amountMinor, recipient, employeeId, employeeName, providerStatus, lastError, createdAt, updatedAt, … }] }`
- **Rules** — Non-terminal attempts for the org (Quick Pay + payroll), newest first, limit 50. Used by `PendingPaymentsDock`.

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
- **Client** — `api.reconcileOpenPayments`
- **Response** — `{ checked, attempts }` from `reconcileOpenPayments(env, 5)`
- **Rules** — Batch up to 5 open attempts (includes funding_* states). Pending Payments dock calls this while items are in flight. No-op if live gate closed.

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
