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
| `/invite/:token?` | `InviteView` | Public | No |
| `/pay` | `PayView` | Admin | Pay |
| `/recipients` | `RecipientsView` | Admin | Recipients |
| `/overview` | `OverviewView` | Admin | Overview |
| `/teams/create` | `CreateTeamView` | Admin | No (in-page entry) |
| `/payments` | `PaymentHistoryView` | Admin | No (in-page entry) |
| `/my-pay` | `MyPayView` | Employee | My Pay |
| `/` | role redirect | Authed | — |

Guards:

- `RequireAuth` — redirect anonymous users to `/login`
- `RequireAdmin` / `RequireEmployee` — role isolation
- `RedirectIfAuthed` — keep logged-in users out of auth pages
- `/` sends admin → `/pay`, employee → `/my-pay`

Design-preview bypass remains in `main.tsx` (`/design-preview` or `?preview=decash`).

### Auth views (ported)

Login / register / accept-invite UI lives under `src/views/auth/` (legacy layout pending Figma redesign).

- Shared helpers: `src/views/auth/auth-shared.tsx`
- API hooks (react-query): `src/hooks/use-auth-api.ts` — `useLoginMutation`, `useRegisterMutation`, `useAcceptInviteMutation`, `useResolveInviteQuery`
- On success, views call `useAuthStore.applyAuthedUser(user)` then navigate admin → `/pay`, employee → `/my-pay`
- Legacy reference: `src/auth/AuthPages.tsx` (not mounted)

## Layout

Authenticated pages use `AppLayout`:

1. `AppHeader` (logo + primary nav + wallet chip + menu button)
2. `<Outlet />` content area

Header specs (Figma `59:11715`):

- Page background `#f6f6f6`
- Header controls height `42px`, vertical padding ~`20px`
- Logo: `/logo.svg`
- Admin nav pills: Pay / Recipients / Overview inside a white capsule; active = black pill + white text
- Wallet chip: `IdentityAvatar` + truncated address (`Space Grotesk`)
- Menu button: `/icons/menu.svg` (no panel content yet)

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

## Wallet architecture

Module: `src/wallet/`.

```text
src/wallet/
├── types.ts            # ChainKind, adapter contracts, errors
├── evm/config.ts       # wagmi + RainbowKit config
├── evm/adapter.ts      # useEvmWallet()
├── WalletProvider.tsx  # WagmiProvider + RainbowKitProvider (+ future chains)
├── use-wallet.ts       # useWallet(chainKind)
└── index.ts
```

Supported kinds in the type system: `"evm" | "near" | "solana"`.

Only EVM is implemented today (RainbowKit / wagmi / viem). NEAR and Solana stubs throw
`UnsupportedChainError` with extension instructions.

Primary wallet use cases:

1. **Admin payment signing** — sign payroll / intent payloads before submit
2. **Employee wallet verification** — prove ownership of a payout address

UI and payment flows should call:

```ts
const wallet = useWallet("evm");
await wallet.signMessage({ message: challenge });
```

Avoid importing wagmi/RainbowKit hooks directly in new page code unless you are extending the adapter layer.

### Adding a new chain

1. Implement `src/wallet/<kind>/adapter.ts` matching `UseWalletResult`
2. Mount the chain SDK provider inside `WalletProvider`
3. Register the branch in `useWallet`
4. Implement address validation + message signing for admin pay + employee verify flows
5. Update this document

`src/lib/wallet.ts` re-exports EVM config for backward compatibility. Prefer `@/wallet`.

## Fonts

- UI chrome (nav): Montserrat
- Address / numeric chips: Space Grotesk
- Existing Geist variable remains as the default sans fallback

## Naming conventions

- Route pages live in `src/views/**` and are named `*View.tsx`
- Layout chrome lives in `src/layouts` + `src/components/layout`
- Stores are named by domain (`auth.ts`, future `team.ts`, …)
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
