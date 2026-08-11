# Auth API

Parent index: [`docs/api.md`](../api.md) · Source: [`api/src/routes/auth.ts`](../../api/src/routes/auth.ts) · Cookie helpers: [`api/src/middleware.ts`](../../api/src/middleware.ts)

## Domain index

| Method | Path | Client |
|---|---|---|
| GET | `/api/auth/registration` | `api.registrationConfig` |
| POST | `/api/auth/register` | `api.register` |
| POST | `/api/auth/login` | `api.login` |
| POST | `/api/auth/logout` | `api.logout` |
| GET | `/api/auth/me` | `api.me` |
| PATCH | `/api/auth/me` | `api.updateMe` |
| POST | `/api/auth/change-password` | `api.changePassword` |

Shared type: `AuthUser` in [`src/lib/api.ts`](../../src/lib/api.ts) and [`api/src/types.ts`](../../api/src/types.ts).

```ts
{ id, email, name, role: "admin"|"employee", org_id, wallet_address, wallet_verified, must_change_password }
```

Callers: [`src/auth/AuthPages.tsx`](../../src/auth/AuthPages.tsx) (legacy), [`src/stores/auth.ts`](../../src/stores/auth.ts) (`me` / logout).

---

### GET /api/auth/registration

- **Auth** — public
- **Response** — `{ inviteRequired: boolean }` from env `REGISTER_INVITE_REQUIRED`
- **Client** — `api.registrationConfig` · callers: `RegisterView`

### POST /api/auth/register

- **Auth** — public
- **Source** — `api/src/routes/auth.ts`
- **Client** — `api.register` · callers: `RegisterView`
- **Request**

  | Field | Type | Required | Notes |
  |---|---|---|---|
  | `email` | string | yes | trimmed, lowercased |
  | `password` | string | yes | min 8 |
  | `name` | string | yes | |
  | `orgName` | string | yes | creates organization |
  | `inviteCode` | string | when `REGISTER_INVITE_REQUIRED=true` | single-use code from `register_invite_codes` |

- **Response** — `201` `{ user: AuthUser }` + `Set-Cookie: sf_token`
- **Errors**

  | Status | Code | When |
  |---|---|---|
  | 400 | — | invalid email / short password / missing name or orgName |
  | 400 | `INVITE_CODE_REQUIRED` | invite required but missing |
  | 400 | `INVITE_CODE_INVALID` | code missing/used/invalid |
  | 409 | — | email already exists |
  | 503 | `PASSWORD_HASH_UNAVAILABLE` | hash failure |

- **Rules** — Creates org + admin user (`role=admin`, `status=active`, `must_change_password=0`). One account → one org model. When invite required, claims unused code before insert.
- **Gotchas** — Does not create an employee row for the admin. See [`docs/register-invite-codes.md`](../register-invite-codes.md).

---

### POST /api/auth/login

- **Auth** — public
- **Source** — `api/src/routes/auth.ts`
- **Client** — `api.login` · callers: legacy Login
- **Request** — `{ email, password }`
- **Response** — `200` `{ user: AuthUser }` + `Set-Cookie`
- **Errors**

  | Status | When |
  |---|---|
  | 401 | invalid email/password |
  | 403 | account disabled |

- **Rules** — Updates `users.updated_at`.

---

### POST /api/auth/logout

- **Auth** — public (no JWT required)
- **Source** — `api/src/routes/auth.ts`
- **Client** — `api.logout` · callers: auth store / AppHeader
- **Request** — none
- **Response** — `{ ok: true }` + clear cookie (`Max-Age=0`)
- **Errors** — n/a
- **Rules** — Always clears cookie even if already logged out.

---

### GET /api/auth/me

- **Auth** — JWT (`authMiddleware`; not `requireRole`)
- **Source** — `api/src/routes/auth.ts`
- **Client** — `api.me` · callers: `stores/auth.ts` bootstrap
- **Request** — none
- **Response** — `{ user: AuthUser | null }` — null if JWT valid but user missing/disabled
- **Errors** — `401` if no/invalid token
- **Gotchas** — Valid cookie + disabled user returns `{ user: null }` (200), not 401, after middleware accepted JWT. Middleware rejects bad token with 401; `loadUser` may still return null.

---

### PATCH /api/auth/me

- **Auth** — JWT
- **Source** — `api/src/routes/auth.ts`
- **Client** — `api.updateMe` · callers: legacy Settings
- **Request** — `{ name?: string }` (empty/omitted name → no DB update)
- **Response** — `{ user: AuthUser | null }`
- **Errors** — `401` if `loadUser` returns null
- **Rules** — Only `name` is updatable here. Wallet binding is under `/api/records/wallet/*`.

---

### POST /api/auth/change-password

- **Auth** — JWT
- **Source** — `api/src/routes/auth.ts`
- **Client** — `api.changePassword` · callers: `ChangePasswordDialog`
- **Request**

  | Field | Type | Required | Notes |
  |---|---|---|---|
  | `newPassword` | string | yes | min 8 |
  | `currentPassword` | string | when `must_change_password=false` | required for normal password updates |

- **Response** — `{ ok: true, user: AuthUser }`
- **Errors**

  | Status | When |
  |---|---|
  | 400 | short new password / missing current password when required |
  | 401 | wrong current password / unauthorized |
  | 503 | `PASSWORD_HASH_UNAVAILABLE` |

- **Rules** — Invite-created accounts (`must_change_password=true`) may set a new password without `currentPassword`. Clears `must_change_password` on success.
