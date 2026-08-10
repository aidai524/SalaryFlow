# DECash

USDC/USDT stablecoin payroll for global teams with confidential payments.

> Formerly known as SalaryFlow. Runtime storage keys (e.g. `salaryflow:theme:v1`) are unchanged for compatibility.

- **Accounts**: email + password (PBKDF2), admin/employee roles, email invitations (Resend)
- **Payout safety**: employees prove EVM wallet ownership with a 10-minute, one-time ERC-191 challenge
- **Payments**: EVM wallet authorization → NEAR Intents 1Click API → confidential swaps (amounts hidden from public chains)
- **Frontend**: React 19 + Vite (deploy: Cloudflare Pages)
- **Backend**: Cloudflare Worker (Hono) + D1 database (deploy: Cloudflare Workers)

## Architecture

```
Browser (React SPA) ── /api ──► Cloudflare Worker (Hono) ──► D1 (SQLite)
        │                              │
        │                              ├── Resend (invitation emails)
        │                              ├── NEAR Intents 1Click API (quotes/intents/status)
        │                              └── scheduled reconciliation (one due attempt/run)
        │
        └── EVM wallet (wagmi/viem) — signs payment intents (ERC-191)
```

- Wallet private keys never leave the browser; the 1Click Partner API key never leaves the Worker.
- Swap details settle on NEAR Intents' private chain (FAR); deposit/withdrawal transactions on external chains remain public.

## Run locally

Requires Node 20+.

```bash
npm install
npm run verify         # frontend/API type checks + production web build
npm run verify:full    # verify + isolated local-D1 API smoke test

# 1. Start the API (Cloudflare Worker + local D1)
cd api
npx wrangler d1 migrations apply salaryflow --local
npm run dev            # http://127.0.0.1:8787

# 2. Start the web app (proxies /api to 8787)
cd ..
npm run dev            # http://127.0.0.1:5173
```

Register the first admin account in the UI — it creates the organization automatically.
Then invite team members from **Team payouts → Invitations** (mock email prints the invite link in the response).

To test real invitation delivery locally, copy `api/.dev.vars.example` to the ignored
`api/.dev.vars`, set `RESEND_API_KEY`, keep `MOCK_EMAIL=false`, and restart the API Worker.
Do not put the key in `wrangler.toml` or commit `.dev.vars`.

## Environment / secrets

API (`api/wrangler.toml` + `wrangler secret put`):

| Variable | Required | Purpose |
|---|---|---|
| `JWT_SECRET` | yes (prod) | HMAC key for session JWTs |
| `RESEND_API_KEY` | for real email | Invitation emails; leave `MOCK_EMAIL=true` locally |
| `SENDER_EMAIL` | for custom domain | From address, e.g. `SalaryFlow <invites@salaryflow.dev>` |
| `INTENTS_API_KEY` | for live payments | NEAR Intents Partner JWT from https://partners.near-intents.org |
| `INTENTS_ASSET_MAP` | for live payments | JSON map of `{assetId, decimals}` for confidential source assets and per-network destination assets |
| `INTENTS_QUOTE_PUBLIC_KEY` | local test / key rotation only | Optional Ed25519 manager key override; production normally uses the official key bundled by 1Click SDK 0.1.25 |
| `PAYMENTS_MODE` | yes | `dry-run` locally; only explicit `live` enables stateful provider routes |
| `PAYMENTS_EXECUTION_ACK` | for live payments | Must equal `mainnet-live`; missing/wrong values keep execution blocked |
| `APP_URL` | yes | Frontend origin (used for CORS + invite links) |
| `COOKIE_DOMAIN` | prod | e.g. `.salaryflow.dev` when frontend/API share a parent domain |

Web: none (Vite proxy handles `/api` in dev).

### Resend note

- With the shared `onboarding@resend.dev` sender, Resend only sends to the email address associated
  with the Resend account. Resend's `delivered@resend.dev` address can test provider acceptance but
  does not provide an inbox for clicking the invitation link.
- To email arbitrary recipients, verify a domain at https://resend.com/domains (e.g. `salaryflow.dev`),
  then set `SENDER_EMAIL` to an address on that domain and use `wrangler secret put` for the API key.

## Deploy to Cloudflare

The production frontend is the existing `salaryflow-payroll-prototype` Pages project. Its
`/api/*` Pages Function calls the `salaryflow-api` Worker through a service binding, so auth
cookies and invitation links remain same-origin.

### 1. API (Workers + D1)

```bash
cd api
wrangler login
npx wrangler d1 migrations apply salaryflow --remote
wrangler secret put JWT_SECRET
wrangler secret put RESEND_API_KEY      # optional
wrangler secret put INTENTS_API_KEY     # optional until live payments
npm run deploy
```

### 2. Web (Pages)

```bash
npm run build
npm run deploy:web
```

Production uses `https://salary.stableflow.ai` with an empty `COOKIE_DOMAIN`; the Pages Function proxy
makes `/api` same-origin. The Cloudflare Pages project URL is a deployment fallback only and must not
be used in user-facing invitation links.

## Payment flow (current safety mode)

The default build only permits an explicit local dry-run preflight. The Worker validates that every pending
item is linked to an employee whose current payout wallet has a successful ownership signature, with a
supported token, network, amount, and EVM payout address. It does
not call 1Click. Intent generation, submission, and status execution routes are rejected, so no wallet
signature or funds movement can be triggered, and dry runs do not create payment records.

The stateful live implementation is present but dormant. It requires both `PAYMENTS_MODE=live` and
`PAYMENTS_EXECUTION_ACK=mainnet-live`, the official 1Click origin, a Partner key, and a complete asset map.
Before requesting a quote, the API checks every configured asset ID, symbol, decimals, and destination chain
against 1Click's `/v0/tokens` metadata. Quote execution fields are consumed only after the official SDK verifies
the Ed25519 signature; reconciliation also verifies that the status response embeds the same signed quote.
The automated smoke test exercises that code against a loopback-only fake provider; the local-test
acknowledgement is rejected for non-loopback provider URLs.

Draft payroll runs can be renamed, rescheduled, and archived. Their pending payment rows can be edited or
removed, and recurring schedules can be renamed, rescheduled, paused, resumed, or archived. These actions use
soft deletion and append audit events; they never erase payroll history. As soon as a payment attempt exists,
the affected payment and run metadata become immutable.

## Stateful payment flow (implemented, mainnet not enabled)

1. A signature-verified admin wallet creates one idempotent payment attempt per payroll item.
2. The API validates provider token metadata, requests an exact-output confidential quote, verifies its Ed25519
   signature and request echo, then persists the response and canonical quote hash before signing.
3. The API generates an ERC-191 intent tied to the verified wallet; the browser signs the exact payload.
4. The server verifies the raw wallet signature, encodes it for NEAR Intents, and submits once.
5. A scheduled reconciler polls one due deposit address per minute, re-verifies the embedded signed quote and
   stored quote hash, then maps provider states to payroll items, chain records, and aggregate run status.
   Unknown submission outcomes are reconciled instead of blindly retried.

> Note: NEAR Intents has **no testnet**. Live testing uses small amounts on NEAR mainnet with
> the Partner API key. Quotes with `dry: true` validate without executing.
>
> PYUSD is **not yet** supported by NEAR Intents (verified against the live token list);
> USDC/USDT cover Base, Arbitrum, Polygon, Optimism, Ethereum, BNB and 25+ other chains.

## Roles

| Capability | Admin | Employee |
|---|---|---|
| Organization + employee directory | ✅ | — |
| Payroll runs + payment (wallet sign) | ✅ | — |
| View all chain records | ✅ | — |
| Own pay, history, payout method, consent | — | ✅ |
| Update own payout method | — | ✅ |
| Sign one-time payout wallet ownership challenge | — | ✅ |
