# Records / Payout / Wallet / Consents API

Parent index: [`docs/api.md`](../api.md) · Source: [`api/src/routes/records.ts`](../../api/src/routes/records.ts)

## Domain index

| Method | Path | Client |
|---|---|---|
| GET | `/api/records` | `api.listRecords` |
| GET | `/api/records/me` | `api.myRecords` |
| GET | `/api/records/me/payout` | `api.myPayout` |
| PUT | `/api/records/me/payout` | `api.updatePayout` |
| POST | `/api/records/me/payout/challenge` | `api.createPayoutChallenge` |
| POST | `/api/records/me/payout/verify` | `api.verifyPayout` |
| POST | `/api/records/consents` | `api.signConsent` |
| GET | `/api/records/consents/me` | `api.myConsent` |
| POST | `/api/records/wallet/challenge` | `api.createPaymentWalletChallenge` |
| POST | `/api/records/wallet/verify` | `api.verifyPaymentWallet` |
| PUT | `/api/records/wallet` | — always 409 |
| DELETE | `/api/records/wallet` | `api.unbindWallet` |

## Gotcha: two wallets

| Concern | Endpoints | Persistence |
|---|---|---|
| Employee **receives** pay | `/me/payout*` | `employees.*` → also mirrors address onto `users.wallet_*` on verify |
| Admin **pays** payroll | `/wallet*` | `users.wallet_*` only (lowercase EVM for Intents) |

Do not use admin wallet APIs for employee payout UI, or vice versa.

Callers: AppHeader wallet dialogs; legacy employee pages; Overview/Records admin pages.

Challenges expire in **10 minutes**. Signature format: `0x` + 130 hex.

---

### GET /api/records

- **Auth** — admin
- **Client** — `api.listRecords`
- **Response** — `{ records }` from `chain_records` (org-scoped)
- **Type** — client `ChainRecord` is a subset; DB may include extra columns (`attempt_id`, etc.)

---

### GET /api/records/me

- **Auth** — employee
- **Client** — `api.myRecords`
- **Response** — `{ records: PayrunItem[] }` for linked employee; `[]` if no employee profile
- **Gotchas** — Returns **payrun_items**, not `chain_records`. Client types them as `PayrunItem[]`.

---

### GET /api/records/me/payout

- **Auth** — employee
- **Client** — `api.myPayout`
- **Response** — `{ payout: EmployeeSubset | null }` — fields: `id, name, token, network, amount_minor, endpoint, status, payout_verified_at, last_paid_at` (not full `Employee`)
- **Gotchas** — Frontend types as `Employee | null`; missing email/role_title/etc. at runtime.

---

### PUT /api/records/me/payout

- **Auth** — employee
- **Client** — `api.updatePayout`
- **Request** — `{ token, network, endpoint }`
- **Response** — `{ ok: true }`
- **Errors** — 404 no employee; 400 invalid token/network/address
- **Rules** — Sets `status=update_required`, clears `payout_verified_at`. Must challenge+verify again for `ready`.

---

### POST /api/records/me/payout/challenge

- **Auth** — employee
- **Client** — `api.createPayoutChallenge`
- **Request** — `{ token, network, endpoint }`
- **Response** — `{ challengeId, message, address, expiresAt }`
- **Errors** — 400 validation; 404 no employee profile
- **Rules** — Stores challenge row; client signs `message` with `address`.

---

### POST /api/records/me/payout/verify

- **Auth** — employee
- **Client** — `api.verifyPayout`
- **Request** — `{ challengeId, signature }`
- **Response** — `{ ok: true, payout }`
- **Errors** — 400 bad signature; 404 challenge; 409 used; 410 expired
- **Rules** — Employee → `ready` + `payout_verified_at`; updates `users.wallet_address` / `wallet_verified_at` to same address; audit `payout.verified`.
- **Gotchas** — Updating auth store `AuthUser.wallet_*` from this response conflates with admin payment wallet semantics — be careful in UI.

---

### POST /api/records/consents

- **Auth** — employee
- **Client** — `api.signConsent(payload: unknown)`
- **Request** — any JSON (stored as payload)
- **Response** — `{ ok: true, signedAt }`
- **Rules** — Demo archive into `consents`. Links `employee_id` if profile exists.
- **Gotchas** — Legacy UI may send `{ employeeId: user.id }` (user id, not employee id); server ignores that for FK and uses looked-up employee.

---

### GET /api/records/consents/me

- **Auth** — employee
- **Client** — `api.myConsent`
- **Response** — `{ signed: boolean, signedAt: string | null }`
- **Rules** — First consent row for user wins (`SELECT` without ORDER).

---

### POST /api/records/wallet/challenge

- **Auth** — admin
- **Client** — `api.createPaymentWalletChallenge(address)`
- **Request** — `{ address }`
- **Response** — `{ challengeId, message, address, expiresAt }`
- **Errors** — 400 invalid EVM address
- **Rules** — Required before live payment quotes. Separate table `payment_wallet_challenges`.

---

### POST /api/records/wallet/verify

- **Auth** — admin
- **Client** — `api.verifyPaymentWallet`
- **Request** — `{ challengeId, signature }`
- **Response** — `{ ok: true, wallet_address, wallet_verified_at }` — address **lowercased**
- **Errors** — 400/404/409/410; 409 `ACTIVE_PAYMENT_ATTEMPTS` when changing wallet while open attempts exist for old signer
- **Rules** — Writes `users.wallet_*`. Blocks change if prior wallet has active attempts.

---

### PUT /api/records/wallet

- **Auth** — admin
- **Client** — none
- **Response** — always `409` `{ code: "WALLET_SIGNATURE_REQUIRED" }`
- **Rules** — Ownership must go through challenge/verify. Do not add a client for this.

---

### DELETE /api/records/wallet

- **Auth** — admin
- **Client** — `api.unbindWallet`
- **Response** — `{ ok: true }`
- **Errors** — 409 `ACTIVE_PAYMENT_ATTEMPTS`
- **Rules** — Clears `users.wallet_address` / `wallet_verified_at`. Audit `payment_wallet.removed`.
