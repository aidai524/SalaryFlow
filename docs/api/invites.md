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
  | `email` | string | yes | |
  | `role` | `"admin"\|"employee"` | no | default `employee` |

- **Response** — `201` `{ invitation, mail, inviteUrl? }` — `inviteUrl` only when `mail.mock` (`MOCK_EMAIL=true`)
- **Errors**

  | Status | Code | When |
  |---|---|---|
  | 400 | — | invalid email |
  | 409 | — | already member / other org / pending invite exists |
  | 502 | `INVITE_EMAIL_FAILED` | **Invitation already inserted**; email failed. Body includes `invitation` |

- **Rules** — Expires in 7 days. Writes audit `invite.created` / `invite.email_failed`.
- **Gotchas** — On 502, do not create again; use resend after fixing mail config.

---

### GET /api/invites/resolve/:token

- **Auth** — public
- **Source** — `api/src/routes/invites.ts`
- **Client** — `api.resolveInvite`
- **Request** — path `token`
- **Response** — `{ invitation: { email, role, orgName, accountExists } }`
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
  | `token` | string | yes | |
  | `email` | string | yes | must match invite |
  | `password` | string | yes | min 8; verifies existing account |
  | `name` | string | if new user | required when account does not exist |

- **Response** — `{ ok: true, user: AuthUser }` + `Set-Cookie`
- **Errors** — 404/410 invite; 400 email/name/password; 401 wrong password for existing; 409 already member / other org / employee linked elsewhere; 503 `PASSWORD_HASH_UNAVAILABLE`
- **Rules** — Creates or links user; employee role links/creates `employees` row (`status=pending` if new); marks invite `accepted`.
- **Gotchas** — Frontend type requires `name` always; backend allows omit when `accountExists`.

---

### POST /api/invites/:id/resend

- **Auth** — admin
- **Source** — `api/src/routes/invites.ts`
- **Client** — `api.resendInvite`
- **Request** — path `id`
- **Response** — `{ ok: true, mail, inviteUrl? }`
- **Errors** — 404; 409 accepted/revoked; 502 `INVITE_EMAIL_FAILED` (token **not** rotated if mail fails)
- **Rules** — On mail success: rotates token + expires_at, status → `pending`.

---

### POST /api/invites/:id/revoke

- **Auth** — admin
- **Source** — `api/src/routes/invites.ts`
- **Client** — `api.revokeInvite`
- **Request** — path `id`
- **Response** — `{ ok: true }`
- **Errors** — 401/403 (soft update; missing id still returns ok)
- **Rules** — Sets `status=revoked`.
