# Invites API

Parent index: [`docs/api.md`](../api.md) · Source: [`api/src/routes/invites.ts`](../../api/src/routes/invites.ts) · Mail: [`api/src/mail.ts`](../../api/src/mail.ts)

## Domain index

| Method | Path | Client |
|---|---|---|
| GET | `/api/invites` | `api.listInvites` |
| POST | `/api/invites` | `api.createInvite` |
| GET | `/api/invites/resolve/:token` | `api.resolveInvite` |
| POST | `/api/invites/accept` | `api.acceptInvite` |
| POST | `/api/invites/:id/resend` | `api.resendInvite` |
| POST | `/api/invites/:id/revoke` | `api.revokeInvite` |

Types: `Invitation`, `InviteMailResult` in [`src/lib/api.ts`](../../src/lib/api.ts).

Callers: legacy [`src/pages/admin/TeamPayouts.tsx`](../../src/pages/admin/TeamPayouts.tsx), [`src/auth/AuthPages.tsx`](../../src/auth/AuthPages.tsx) InvitePage.

**Rules (org model)** — One account per organization. Cannot invite someone who already belongs to another org.

---

### GET /api/invites

- **Auth** — admin
- **Source** — `api/src/routes/invites.ts`
- **Client** — `api.listInvites`
- **Request** — none
- **Response** — `{ invitations: [{ id, email, role, status, expires_at, created_at }] }`
- **Errors** — 401/403
- **Rules** — Org-scoped, newest first. Token not returned.

---

### POST /api/invites

- **Auth** — admin
- **Source** — `api/src/routes/invites.ts`
- **Client** — `api.createInvite`
- **Request**

  | Field | Type | Required | Notes |
  |---|---|---|---|
  | `name` | string | yes | Prefill for account/employee profile on accept |
  | `email` | string | yes | |
  | `role` | `"admin"\|"employee"` | no | Account role; default `employee` |
  | `role_title` | string | no | Job title enum (`Developer` \| `Product` \| `Growth` \| `Finance` \| `Operations`) |
  | `employee_type` | `"employee"\|"contractor"` | no | Recipient type; default `employee` |

- **Response**
  - First invite: `201` `{ invitation, mail, inviteUrl?, resent: false }`
  - Same org + email already `pending`: `200` `{ invitation, mail, inviteUrl?, resent: true }` — rotates token (old invite links stop resolving) and re-sends mail
  - `inviteUrl` only when `mail.mock` (`MOCK_EMAIL=true`)
- **Errors**

  | Status | Code | When |
  |---|---|---|
  | 400 | — | missing name / invalid email / invalid type or role_title |
  | 409 | — | already a member of this org, or account belongs to another org |
  | 503 | `INVITE_EMAIL_FAILED` | Email failed. Body may include `invitation`. On first create the row may already exist; retrying `POST /invites` resends |

- **Rules** — Expires in 7 days. Persists `name`, `role_title`, `employee_type` on the invitation; accept applies them to the employee profile. Same-email pending invites are **not** blocked — repeat `POST /invites` resends and invalidates the previous token after a successful send. Writes audit `invite.created` / `invite.resent` / `invite.email_failed`.
- **Gotchas** — Safe to click Send again if the recipient did not get the email; do not expect a pending 409.

---

### GET /api/invites/resolve/:token

- **Auth** — public
- **Source** — `api/src/routes/invites.ts`
- **Client** — `api.resolveInvite`
- **Request** — path `token`
- **Response** — `{ invitation: { email, name, role, orgName, accountExists } }`
- **Errors**

  | Status | When |
  |---|---|
  | 404 | token unknown |
  | 410 | accepted / revoked / expired (expired rows flipped to `expired`) |

---

### POST /api/invites/accept

- **Auth** — public (sets session cookie on success)
- **Source** — `api/src/routes/invites.ts`
- **Client** — `api.acceptInvite`
- **Request**

  | Field | Type | Required | Notes |
  |---|---|---|---|
  | `token` | string | yes | invitation token from email link |

- **Response** — `{ ok: true, user: AuthUser }` + `Set-Cookie` (`must_change_password: true` for new accounts)
- **Errors**

  | Status | Code | When |
  |---|---|---|
  | 404/410 | — | invite missing / invalid / expired |
  | 400 | — | invitation missing name |
  | 409 | `ACCOUNT_EXISTS` | email already has an account (sign in instead) |
  | 409 | — | employee profile already linked |
  | 503 | `PASSWORD_HASH_UNAVAILABLE` | hash failure |

- **Rules** — Creates user with a **server-generated random default password** (never returned). Prefills name/email/role/type from invitation. Employee role links/creates `employees` row (`status=pending` if new). Marks invite `accepted`. Sets `must_change_password=1`.
- **Gotchas** — No password/name in the request body; frontend auto-accepts on open invite link, then prompts Connect Wallet + change password.
---

### POST /api/invites/:id/resend

- **Auth** — admin
- **Source** — `api/src/routes/invites.ts`
- **Client** — `api.resendInvite`
- **Request** — path `id`
- **Response** — `{ ok: true, mail, inviteUrl? }`
- **Errors** — 404; 409 accepted/revoked; 503 `INVITE_EMAIL_FAILED` (token **not** rotated if mail fails)
- **Rules** — On mail success: rotates token + expires_at, status → `pending` (same rotation helper as repeat `POST /invites`).

---

### POST /api/invites/:id/revoke

- **Auth** — admin
- **Source** — `api/src/routes/invites.ts`
- **Client** — `api.revokeInvite`
- **Request** — path `id`
- **Response** — `{ ok: true }`
- **Errors** — 401/403 (soft update; missing id still returns ok)
- **Rules** — Sets `status=revoked`.
