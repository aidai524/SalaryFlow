# DECash Frontend Architecture

This document describes the UI architecture after the DECash refactor foundation.

## Language policy (agents)

- **Code, comments, UI copy, and docs in this repo:** English only. Never add Chinese to source files or product UI.
- **Implementation plans** (Cursor plan mode / `.plan.md`): Chinese (Simplified).
- Chat replies to the user may be Chinese; committed artifacts follow the table in `docs/page-migration-guide.md`.

## Product rename

- Display name: **DECash**
- Favicon: `/favicon.ico`
- `package.json` name: `decash`
- RainbowKit / wagmi `appName`: `DECash`
- Legacy runtime keys (e.g. `salaryflow:theme:v1`) stay unchanged for compatibility

## Directory map

```text
src/
├── App.tsx                 # Auth bootstrap + RouterProvider
├── main.tsx                # Providers (theme, query, wallet)
├── router/                 # Route table + auth/role guards
├── layouts/AppLayout.tsx   # Header + content shell
├── components/layout/      # AppHeader and related chrome
├── views/                  # Route-level pages (new UI)
│   ├── auth/
│   ├── admin/
│   └── employee/
├── stores/                 # Zustand client/UI stores
├── wallet/                 # Multi-chain wallet abstraction
├── pages/                  # Legacy screens (reference only, not mounted)
└── components/             # Shared UI + legacy business components
```

Legacy `src/pages/*` and `src/components/Shell.tsx` remain as business-logic reference
during page-by-page migration. Do not wire them back into the router unless explicitly asked.

## Routing

Router: `react-router-dom` (`createBrowserRouter` in `src/router/index.tsx`).

| Path | View | Audience | Header nav |
|---|---|---|---|
| `/login` | `LoginView` | Public | No |
| `/register` | `RegisterView` | Public | No |
| `/invite/:token?` | `InviteView` | Public → auto session | No (invite onboarding) |
| `/pay` | `PayView` | Admin | Pay |
| `/recipients` | `RecipientsView` | Admin | Recipients |
| `/overview` | `OverviewView` | Admin | Overview |
| `/teams/create` | `CreateTeamView` | Admin | No (onboarding chrome) |
| `/payments` | `PaymentHistoryView` | Admin | No (in-page entry) |
| `/my-pay` | `MyPayView` | Employee | My Pay |
| `/` | role redirect | Authed | — |

Guards:

- `RequireAuth` — redirect anonymous users to `/login`
- `RequireAdmin` / `RequireEmployee` — role isolation
- `RedirectIfAuthed` — keep logged-in users out of `/login` and `/register` (`/invite` stays mountable after auto-accept)
- Admin without team payment prefs (`paymentConfigured === false`) → `/teams/create`; configured → `/pay`
- `/` and post-login/register: admin → `adminHomePath(paymentConfigured)`, employee → `/my-pay`

Design-preview bypass remains in `main.tsx` (`/design-preview` or `?preview=decash`).

### Create Team onboarding

- Route: `/teams/create` · view: `src/views/admin/CreateTeamView.tsx` + `create-team/*`
- Org already exists from register (`orgName` required). This page only configures **team payment preferences**.
- API: `PATCH /api/org/team` (`api.updateTeam`) — writes `organizations.payment_*` fields. Does **not** call `createRun` / create payroll runs.
- UI: lime background `#c8e458`, dollar watermarks (`/decash/dollar-mark.svg`), centered `/logo.svg`, Rubik One slogan, Montserrat form; selects use `/icons/to-down.svg`.
- Header variant `onboarding`: wallet chip + account menu only (no primary nav / header logo).

### Auth views

Login / register / invite UI lives under `src/views/auth/` (Figma lime shell aligned with Create Team).

- Shared layout: `src/views/auth/AuthShell.tsx` + `config.ts` (`#C8E458`, dollar watermarks, logo, slogan)
- Shared helpers: `src/views/auth/auth-shared.tsx`
- Invite with token: auto `POST /invites/accept` (server default password) → Welcome + Connect Wallet (payout verify) → `/my-pay` + `ChangePasswordDialog` when `must_change_password`
- `/invite/:token?` is **not** wrapped in `RedirectIfAuthed` so the session can stay on the Welcome card after accept
- API hooks: `src/hooks/use-auth-api.ts` — login/register/accept/resolve/`useChangePasswordMutation`
- Legacy reference: `src/auth/AuthPages.tsx` (not mounted)
## Org / team model (phase 1)

- **Phase 1:** one organization per admin (`users.org_id`). Auth store keeps `orgId`, `orgName`, `paymentConfigured` for the current workspace.
- Team payment fields live on `organizations` (`payment_cadence`, `payment_date_key`, `payment_configured_at`; legacy unused `reminder_lead_days`) — separate from `payroll_runs` / schedules.
- **Future multi-org:** memberships + `activeOrgId`; keep query keys scoped by `orgId` (already `["org-context", orgId]`).

## Layout

Authenticated pages use `AppLayout`:

1. `AppHeader` (logo + primary nav + wallet chip + menu button) — or onboarding variant
2. `<Outlet />` content area

Header specs (Figma `59:11715`):

- Page background `#f6f6f6` (Create Team uses `#c8e458`)
- Header controls height `42px`, vertical padding ~`20px`
- Logo: `/logo.svg`
- Admin nav pills: Pay / Recipients / Overview inside a white capsule; active = black pill + white text
- Wallet chip: `IdentityAvatar` + truncated address (`Space Grotesk`); opens Decash-styled wallet dialog (employee payout verify / admin payment wallet)
- Menu button: `/icons/menu.svg` — account menu with **Change password** + Sign out (admin and employee)
- Invite / `must_change_password`: `MyPayView` still auto-opens `ChangePasswordDialog` and blocks dismiss

### My Pay (employee)

- Route: `/my-pay` · view: `src/views/employee/MyPayView.tsx` + `my-pay/*`
- Data: `GET /api/records/me/payout` (profile + schedule + `totalReceivedMinor`), `GET /api/records/me` (`employee_payments` history)
- Edit profile: `AddRecipientDialog` `variant="self"` → `PATCH /api/records/me/profile`; payout changes require ownership re-verify
- UI: greeting, 4-up stats (`StatCell`), profile card, payment history table; icons `IconCheck` / `IconPen`

### Responsive breakpoints

Mobile-first Tailwind prefixes. Target behaviors:

| Viewport | Header behavior |
|---|---|
| `< md` | Two rows: logo + wallet/menu on row 1; nav capsule centered on row 2. Wallet address text hidden (avatar only). |
| `>= md` | Single row grid: logo \| nav \| account. Full wallet address shown. |
| content padding | `px-4` → `sm:px-6` → `md:px-10` → `lg:px-[50px]` |

Every new page must remain usable on narrow phones. Desktop-only Figma frames still require a mobile layout pass.

## State & data conventions

| Concern | Tool | Location |
|---|---|---|
| Server state (API data) | `@tanstack/react-query` | `useQuery` / `useMutation` hooks near features |
| Shared client/UI state | `zustand` | `src/stores/*` |
| Local ephemeral UI | `useState` / `useReducer` | component scope |

Rules:

1. Do **not** hand-roll `fetch` + `useState` loading/error for API reads/writes in new views.
2. Put session identity + lightweight workspace context in `src/stores/auth.ts`.
3. Prefer query keys that include org/user scope when data is tenant-specific.
4. Migrate legacy `src/lib/useData.ts` usage as each page is rebuilt.

### Zustand stores

| Store | Path | Role |
|---|---|---|
| Auth / workspace | `src/stores/auth.ts` | Session user, orgId, paymentConfigured |
| Intents tokens | `src/stores/intents-tokens.ts` | Cached 1Click `/v0/tokens` (USDT/USDC, phase-1 EVM), 30min TTL + localStorage |
| Global drawers | `src/stores/drawer.ts` | Open recipient picker (and future drawers) from any admin page |

`GlobalDrawerHost` mounts under `AppLayout` for admin users and renders drawer content from the drawer store.

### Formatting & logos

- Numbers / currency / dates: `src/lib/format.ts` (`Intl` en-US)
- Chain / token / route logos: `src/lib/logo.ts` (CDN `assets.dapdap.net`, same paths as StableFlow)
- Chain registry: `src/config/chains.ts` (phase-1 EVM; non-EVM kinds reserved)

### Pay (admin home)

- Route `/pay` → `src/views/admin/PayView.tsx`
- Quick Pay module: `src/components/quick-pay/QuickPayPanel.tsx` (capsule recipient select on `/pay`; Pay Now dialog uses `recipientLocked` + `compensationLayout="centered"` + `destinationTokenLocked`)
- Token/network picker: `src/components/token-network-dialog/TokenNetworkDialog.tsx`
- Recipient drawer: `src/components/drawer/RecipientPickerDrawer.tsx` (kept mounted; Quick Pay no longer opens it)
- Overview data: `GET /api/org/pay-overview` via `src/hooks/use-pay-api.ts`
- Period helpers (payday / `period_key`): `api/src/pay-period.ts`
- Recipients deep link: overview list → `/recipients?selected=<employeeId>`

Team switcher control next to the greeting is **disabled** until multi-team lands.

### Overview (admin dashboard)

- Route `/overview` → `src/views/admin/OverviewView.tsx` + `src/views/admin/overview/*`
- Aggregation: `GET /api/org/overview?periodKey=&volumeRange=` via `src/hooks/use-overview-api.ts`
- Period picker: shared `PaymentPeriodPicker` (`labelFormat="short"`)
- Charts: `recharts` (Payment Volume bar + Spend Category donut)
- Payment History entry: `/payments?period=<periodKey>` (Review Payments / View All)

### Payment History (admin)

- Route `/payments` → `src/views/admin/PaymentHistoryView.tsx` + `src/views/admin/payment-history/*`
- List: `GET /api/org/payments?periodKey=&q=` (no in-page period switcher yet; uses Overview’s selected period via query)
- Status icons: `IconCheck` / `IconAlert` without pill backgrounds

### Recipients (admin)

- Route `/recipients` → `src/views/admin/RecipientsView.tsx` + `src/views/admin/recipients/*`
- Period picker: `src/components/payment-period-picker/PaymentPeriodPicker.tsx` (`date-fns`)
- Hooks: `src/hooks/use-recipients-api.ts`
- List/search/filter/pagination via `GET /api/org/employees`; history via `GET /api/org/employees/:id/payments`
- Migration `0013_recipient_fields.sql`: contractor `payment_cadence` / `payment_date_key`, invitation `role_title`

### Avatar upload (not implemented)

No R2 binding or upload API today (`api/wrangler.toml` is D1-only; `employees` has no `avatar_url`). Recommended follow-up:

1. Create a Cloudflare **R2** bucket and bind it on the Worker (e.g. `AVATARS`).
2. Add `avatar_url` on `employees` + `POST /api/org/employees/:id/avatar` (admin, MIME jpeg/png/webp, size cap) writing `org/{orgId}/employees/{id}`.
3. Prefer Worker-proxied upload over raw D1 blobs or Pages static writes.
4. UI already uses `IdentityAvatar` (optional `src`) and a camera placeholder (“coming soon”).

## Wallet architecture

Module: `src/wallet/`.

```text
src/wallet/
├── types.ts            # ChainKind, adapter contracts, errors
├── evm/config.ts       # wagmi + RainbowKit config
├── evm/adapter.ts      # useEvmWallet()
├── evm/transfer.ts     # ERC-20 balance + transfer encoding (Quick Pay)
├── WalletProvider.tsx  # WagmiProvider + RainbowKitProvider (+ future chains)
├── use-wallet.ts       # useWallet(chainKind)
└── index.ts
```

Supported kinds in the type system: `"evm" | "near" | "solana"`.

Only EVM is implemented today (RainbowKit / wagmi / viem). NEAR and Solana stubs throw
`UnsupportedChainError` with extension instructions.

Primary wallet use cases:

1. **Admin Quick Pay** — ERC-20 transfer on the chosen origin chain to the 1Click deposit address (ORIGIN_CHAIN confidential swap)
2. **Admin payment signing** — legacy payroll-run path still uses ERC-191 intent signatures
3. **Employee wallet verification** — prove ownership of a payout address

UI and payment flows should call:

```ts
const wallet = useWallet("evm");
await wallet.signMessage({ message: challenge });
```

ERC-20 deposit helpers live in `src/wallet/evm/transfer.ts`. Prefer those over scattering wagmi/viem calls in page components.

### Adding a new chain

1. Implement `src/wallet/<kind>/adapter.ts` matching `UseWalletResult`
2. Mount the chain SDK provider inside `WalletProvider`
3. Register the branch in `useWallet`
4. Implement address validation + message signing for admin pay + employee verify flows
5. Update this document

`src/lib/wallet.ts` re-exports EVM config for backward compatibility. Prefer `@/wallet`.

## Fonts

- UI chrome (nav / forms): Montserrat — Regular from `public/fonts/Montserrat-Regular.ttf`; 500/600 still from `@fontsource/montserrat`
- Address / numeric chips: Space Grotesk — Regular from `public/fonts/SpaceGrotesk-Regular.ttf`; 500 from `@fontsource/space-grotesk`
- Slogan (Create Team): Rubik One — `public/fonts/RubikOne-Regular.ttf`
- Tailwind tokens: `font-montserrat`, `font-space-grotesk`, `font-rubik-one` (`--font-*` in `src/styles.css`)
- Existing Geist variable remains as the default sans fallback

## Naming conventions

- Route pages live in `src/views/**` and are named `*View.tsx`
- Layout chrome lives in `src/layouts` + `src/components/layout`
- Stores are named by domain (`auth.ts`, `intents-tokens.ts`, `drawer.ts`, …)
- Shared primitives stay in `src/components/ui` (shadcn)
- Language: English in code/UI/docs; Chinese only for agent plans (see Language policy)

## Package manager

Prefer **pnpm** for installs in agent/local workflows (`pnpm add`, `pnpm install`).

Do **not**:

- delete `package-lock.json`
- add preinstall engines that force pnpm
- rewrite scripts solely to coerce other developers onto pnpm

`pnpm-workspace.yaml` exists so pnpm can resolve the `api` workspace. npm users can continue using existing npm scripts/lockfile.

## API reference

Agent-oriented HTTP contracts (handlers, client methods, error codes, debug map):

- [`docs/api.md`](api.md) — entry index
- Domain docs under [`docs/api/`](api/)
