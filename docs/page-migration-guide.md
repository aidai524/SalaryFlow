# Page Migration Guide (for agents)

Use this checklist when implementing one Figma screen into DECash.

## Goals

- Replace a placeholder under `src/views/**` with production UI
- Keep architecture boundaries intact (router, layout, wallet, state)
- Ship clean, reusable, mobile-responsive code

## Language policy (agents)

| Artifact | Language |
|---|---|
| Source code, comments, string literals, UI copy, error messages | **English only** — no Chinese characters in the repo |
| Docs under `docs/` | **English only** |
| Cursor / agent **plans** (`.plan.md`, plan mode output) | **Chinese (Simplified)** |

Do not put Chinese in React components, hooks, stores, API clients, or user-facing pages. When talking to the user or writing an implementation plan, use Chinese; when writing product code and docs, use English.

## Non-negotiable rules

1. Follow the **Language policy** above (English code/UI/docs; Chinese plans).
2. **Keep code clean** — small components, clear names, no dead code, no drive-by refactors outside the page.
3. **Reuse first** — prefer `src/components/ui/*`, `IdentityAvatar`, layout primitives, and existing dialogs/hooks before inventing duplicates.
4. **Mobile responsive is mandatory** — even if Figma only provides desktop. Mobile-first layout, shared breakpoints from `docs/architecture.md`, verify narrow widths.
5. **Server state via `@tanstack/react-query`** — no new ad-hoc `fetch` + `useState` API loading patterns.
6. **Shared client state via `zustand`** (`src/stores/*`) — do not recreate auth/session context providers.
7. **Wallet via `useWallet(chainKind)`** — do not scatter wagmi/RainbowKit calls through page components.
8. **Package manager: pnpm preferred** (`pnpm add <pkg>`). Do not delete `package-lock.json`, do not add forced-pnpm preinstall scripts, do not require every developer to switch.

## Workflow

### 1. Confirm target route + view file

| Screen | Route | File |
|---|---|---|
| Login | `/login` | `src/views/auth/LoginView.tsx` (ported; redesign later) |
| Register | `/register` | `src/views/auth/RegisterView.tsx` (ported; redesign later) |
| Accept invite | `/invite/:token?` | `src/views/auth/InviteView.tsx` (ported; redesign later) |
| Pay (admin home) | `/pay` | `src/views/admin/PayView.tsx` (Quick Pay + stats; Figma Decash-Pay) |
| Recipients | `/recipients` | `src/views/admin/RecipientsView.tsx` |
| Overview | `/overview` | `src/views/admin/OverviewView.tsx` |
| Create team | `/teams/create` | `src/views/admin/CreateTeamView.tsx` |
| Payment history | `/payments` | `src/views/admin/PaymentHistoryView.tsx` |
| My pay (employee) | `/my-pay` | `src/views/employee/MyPayView.tsx` (Figma Decash employee home) |

Auth API hooks: `src/hooks/use-auth-api.ts`. Session writes go through `useAuthStore.applyAuthedUser`.

Authenticated screens already render inside `AppLayout` (header + content). Do **not** re-implement the global header inside a page unless the design explicitly changes chrome.

### 2. Pull design context from Figma

- Load the Figma design-to-code skill, then call `get_design_context`
- Treat generated React/Tailwind as a **reference**, not paste-ready code
- Download durable assets into `public/` when committing UI (Figma MCP asset URLs expire)

### 3. Mine legacy logic (do not copy UI)

Legacy implementations still live under:

- `src/pages/admin/*`
- `src/pages/employee/*`
- `src/auth/AuthPages.tsx`
- related components in `src/components/*`

Reuse API calls, validation, and payment/signing flows. Rebuild visuals in the new view.

### 4. Implement the view

Suggested shape:

```tsx
// src/views/admin/PayView.tsx
export function PayView() {
  // react-query for server data
  // zustand for shared session/UI state
  // local useState for form/ephemeral UI
  return (/* page content only */);
}
```

Extract reusable pieces into:

- `src/components/<feature>/...` for multi-page widgets
- `src/components/ui/...` only for generic primitives

### 5. Wire data correctly

Before wiring fetches, look up the endpoint in [`docs/api.md`](api.md) (handler path, `api.*` client method, auth role, error codes). Prefer `src/lib/api.ts` — do not invent parallel `fetch` wrappers.

```ts
// GOOD
const { data, isLoading } = useQuery({ queryKey: ["employees"], queryFn: ... });
const mutation = useMutation({ mutationFn: ... });

// BAD in new views
const [data, setData] = useState([]);
useEffect(() => { fetch(...).then(setData); }, []);
```

Auth/session:

```ts
const user = useAuthStore((s) => s.user);
```

Wallet signing / connect:

```ts
const wallet = useWallet("evm");
```

### 6. Responsive acceptance checklist

Before marking the page done:

- [ ] Layout works at ~375px width without horizontal page scroll (except intentional tables with internal scroll)
- [ ] Touch targets remain usable
- [ ] Header remains correct (page content should not fight global chrome)
- [ ] Cards/grids collapse from multi-column desktop to stacked mobile
- [ ] Typography/spacing follow design tokens / existing Tailwind patterns

### 7. Update docs when behavior changes

If you add routes, stores, wallet chains, or shared layout rules, update:

- `docs/architecture.md`
- this guide (route table / conventions)

## Quality bar

- Typecheck clean (`pnpm run check` or `npm run check`)
- No Chinese in source, comments, UI strings, or `docs/` (plans may be Chinese)
- UI copy is English
- No duplicated avatar/wallet/nav primitives
- No new global CSS unless tokens are genuinely shared
- Prefer composition over one giant view file

## Out of scope reminders

- Do not resurrect legacy `screen` state navigation in `App.tsx`
- Do not remove `package-lock.json` to “standardize” on pnpm
- Do not implement NEAR/Solana adapters unless the task explicitly asks — follow `src/wallet` stubs/comments when you do
