# SalaryFlow

USDC/USDT stablecoin payroll for global teams with confidential payments.

- **Accounts**: email + password (PBKDF2), admin/employee roles, email invitations (Resend)
- **Payments**: EVM wallet authorization → NEAR Intents 1Click API → confidential swaps (amounts hidden from public chains)
- **Frontend**: React 19 + Vite (deploy: Cloudflare Pages)
- **Backend**: Cloudflare Worker (Hono) + D1 database (deploy: Cloudflare Workers)

## Architecture

```
Browser (React SPA) ── /api ──► Cloudflare Worker (Hono) ──► D1 (SQLite)
        │                              │
        │                              ├── Resend (invitation emails)
        │                              └── NEAR Intents 1Click API (quotes/intents/status)
        │
        └── EVM wallet (wagmi/viem) — signs payment intents (ERC-191)
```

- Wallet private keys never leave the browser; the 1Click Partner API key never leaves the Worker.
- Swap details settle on NEAR Intents' private chain (FAR); deposit/withdrawal transactions on external chains remain public.

## Run locally

Requires Node 20+.

```bash
npm install

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

## Environment / secrets

API (`api/wrangler.toml` + `wrangler secret put`):

| Variable | Required | Purpose |
|---|---|---|
| `JWT_SECRET` | yes (prod) | HMAC key for session JWTs |
| `RESEND_API_KEY` | for real email | Invitation emails; leave `MOCK_EMAIL=true` locally |
| `SENDER_EMAIL` | for custom domain | From address, e.g. `SalaryFlow <invites@salaryflow.dev>` |
| `INTENTS_API_KEY` | for live payments | NEAR Intents Partner JWT from https://partners.near-intents.org |
| `APP_URL` | yes | Frontend origin (used for CORS + invite links) |
| `COOKIE_DOMAIN` | prod | e.g. `.salaryflow.dev` when frontend/API share a parent domain |

Web: none (Vite proxy handles `/api` in dev).

### Resend note

- The free Resend plan only sends to the account's verified email (`onboarding@resend.dev` sender).
- To email any recipient, verify a domain at https://resend.com/domains (e.g. `salaryflow.dev`),
  then set `SENDER_EMAIL` to an address on that domain and use `wrangler secret put` for the API key.

## Deploy to Cloudflare

### 1. API (Workers + D1)

```bash
cd api
wrangler login
# create D1 database once, then update database_id in wrangler.toml:
#   wrangler d1 create salaryflow
npx wrangler d1 migrations apply salaryflow --remote
wrangler secret put JWT_SECRET
wrangler secret put RESEND_API_KEY      # optional
wrangler secret put INTENTS_API_KEY     # optional until live payments
npm run deploy
```

### 2. Web (Pages)

```bash
npm run build
npx wrangler pages deploy dist --project-name salaryflow
```

Set `APP_URL` / `COOKIE_DOMAIN` so the cookie is shared: serve the API at `api.<domain>`
with `COOKIE_DOMAIN=.<domain>` and `APP_URL=https://<domain>`; the SPA calls `/api` through
a Pages route/function proxy or the same-origin reverse proxy.

## Payment flow (live)

1. Admin creates a payroll run and adds payments (net amounts, token, network).
2. **Pay now** → API requests a confidential quote (1Click, `CONFIDENTIAL_INTENTS`, `confidentiality: advanced`).
3. API generates an unsigned intent; the admin's EVM wallet signs it (ERC-191, `personal_sign`).
4. API submits the signed intent → `intentHash` stored; status polled.
5. Payment records show intent hashes and confirmation status.

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
