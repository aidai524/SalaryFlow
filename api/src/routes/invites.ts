// Invitations: admin creates (email + role), employee accepts via token (auto account + session)

import { Hono } from "hono";
import { generateRandomPassword, hashPassword, signToken } from "../crypto";
import { requireRole, setAuthCookie, type AppEnv } from "../middleware";
import { sendInviteEmail } from "../mail";
import { normalizeEmployeeType, normalizeRoleTitle } from "../recipient";
import { nowIso, uuid, type AuthUser } from "../types";

export const inviteRoutes = new Hono<AppEnv>();

// Admin: list invitations for org
inviteRoutes.get("/", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const rows = await c.env.DB.prepare(
    "SELECT id, email, role, role_title, name, employee_type, status, expires_at, created_at FROM invitations WHERE org_id = ? ORDER BY created_at DESC",
  ).bind(user.org_id).all<Record<string, unknown>>();
  return c.json({ invitations: rows.results });
});

// Admin: create invitation
inviteRoutes.post("/", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const body = await c.req.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  const inviteName = String(body?.name || "").trim();
  const role = body?.role === "admin" ? "admin" : "employee";
  const roleTitleRaw = body?.role_title ?? body?.roleTitle;
  let roleTitle = "";
  if (roleTitleRaw !== undefined && roleTitleRaw !== null && String(roleTitleRaw).trim()) {
    const normalized = normalizeRoleTitle(roleTitleRaw);
    if (normalized === null) return c.json({ error: "Choose a valid role title" }, 400);
    roleTitle = normalized;
  }
  const typeRaw = body?.employee_type ?? body?.employeeType;
  let employeeType = "employee";
  if (typeRaw !== undefined && typeRaw !== null && String(typeRaw).trim()) {
    const normalized = normalizeEmployeeType(typeRaw);
    if (!normalized) return c.json({ error: "Type must be employee or contractor" }, 400);
    employeeType = normalized;
  }
  if (!inviteName) return c.json({ error: "Name is required" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: "A valid email is required" }, 400);

  // The current data model supports one organization per account. Never silently
  // move an account between organizations or carry a role across workspaces.
  const existingUser = await c.env.DB.prepare(
    "SELECT id, org_id FROM users WHERE email = ?",
  ).bind(email).first<Record<string, unknown>>();
  if (existingUser?.org_id === user.org_id) return c.json({ error: "This person is already a member" }, 409);
  if (existingUser?.org_id && existingUser.org_id !== user.org_id) {
    return c.json({ error: "This account already belongs to another organization" }, 409);
  }

  // prevent duplicate pending invitations to the same email in this org
  const existingInvite = await c.env.DB.prepare(
    "SELECT id FROM invitations WHERE org_id = ? AND email = ? AND status = 'pending'",
  ).bind(user.org_id, email).first();
  if (existingInvite) return c.json({ error: "An invitation to this email is already pending" }, 409);

  const token = uuid().replace(/-/g, "") + uuid().replace(/-/g, "");
  const id = uuid();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const now = nowIso();

  await c.env.DB.prepare(
    `INSERT INTO invitations (
       id, org_id, email, role, role_title, name, employee_type, token, invited_by, status, expires_at, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
  ).bind(
    id,
    user.org_id,
    email,
    role,
    roleTitle || null,
    inviteName,
    employeeType,
    token,
    user.id,
    expiresAt,
    now,
  ).run();

  const org = await c.env.DB.prepare("SELECT name FROM organizations WHERE id = ?").bind(user.org_id).first<{ name: string }>();
  const inviteUrl = `${c.env.APP_URL}/invite/${token}`;
  const mail = await sendInviteEmail(c.env, {
    to: email,
    inviteUrl,
    orgName: org?.name || "your organization",
    inviterName: user.name,
    role,
  });

  await c.env.DB.prepare(
    "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'invite.created', ?)",
  ).bind(uuid(), user.org_id, user.id, `Invited ${email} (${role})`).run();

  const invitationPayload = {
    id,
    email,
    role,
    role_title: roleTitle || null,
    name: inviteName,
    employee_type: employeeType,
    status: "pending",
    expires_at: expiresAt,
  };

  if (!mail.ok) {
    await c.env.DB.prepare(
      "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'invite.email_failed', ?)",
    ).bind(uuid(), user.org_id, user.id, `Email delivery failed for ${email}`).run();
    return c.json({
      error: `Invitation created, but email delivery failed. ${mail.error || "Check the email provider configuration and retry."}`,
      code: "INVITE_EMAIL_FAILED",
      invitation: invitationPayload,
    }, 502);
  }

  return c.json({ invitation: invitationPayload, mail, inviteUrl: mail.mock ? inviteUrl : undefined }, 201);
});

// Public: resolve an invitation token (used by invite page)
inviteRoutes.get("/resolve/:token", async (c) => {
  const token = c.req.param("token");
  const row = await c.env.DB.prepare(
    "SELECT id, org_id, email, role, name, status, expires_at FROM invitations WHERE token = ?",
  ).bind(token).first<Record<string, unknown>>();
  if (!row) return c.json({ error: "Invitation not found" }, 404);
  if (row.status === "accepted") return c.json({ error: "This invitation has already been used" }, 410);
  if (row.status === "revoked") return c.json({ error: "This invitation was revoked" }, 410);
  if (new Date(String(row.expires_at)).getTime() < Date.now()) {
    await c.env.DB.prepare("UPDATE invitations SET status = 'expired' WHERE id = ?").bind(row.id).run();
    return c.json({ error: "This invitation has expired" }, 410);
  }
  const org = await c.env.DB.prepare("SELECT name FROM organizations WHERE id = ?").bind(row.org_id).first<{ name: string }>();
  const existingAccount = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(row.email).first();
  return c.json({
    invitation: {
      email: String(row.email),
      name: String(row.name || ""),
      role: row.role,
      orgName: org?.name || "",
      accountExists: !!existingAccount,
    },
  });
});

// Public: accept invitation — creates account with a server-generated default password and sets session.
// Token-only body: { token }. Name/email come from the invitation row.
inviteRoutes.post("/accept", async (c) => {
  const body = await c.req.json().catch(() => null);
  const token = String(body?.token || "");

  const invite = await c.env.DB.prepare(
    "SELECT id, org_id, email, role, role_title, name, employee_type, status, expires_at FROM invitations WHERE token = ?",
  ).bind(token).first<Record<string, unknown>>();
  if (!invite) return c.json({ error: "Invitation not found" }, 404);
  if (invite.status !== "pending") return c.json({ error: "This invitation is no longer valid" }, 410);
  if (new Date(String(invite.expires_at)).getTime() < Date.now()) {
    await c.env.DB.prepare("UPDATE invitations SET status = 'expired' WHERE id = ?").bind(invite.id).run();
    return c.json({ error: "This invitation has expired" }, 410);
  }

  const email = String(invite.email).trim().toLowerCase();
  const role = invite.role === "admin" ? "admin" : "employee";
  const existing = await c.env.DB.prepare(
    "SELECT id, org_id FROM users WHERE email = ?",
  ).bind(email).first<Record<string, unknown>>();

  if (existing) {
    return c.json({
      error: "An account with this email already exists. Please sign in instead.",
      code: "ACCOUNT_EXISTS",
    }, 409);
  }

  const invitePrefillName = String(invite.name || "").trim();
  if (!invitePrefillName) return c.json({ error: "Name is required on the invitation" }, 400);

  const userId = uuid();
  const displayName = invitePrefillName;
  const employee = role === "employee"
    ? await c.env.DB.prepare(
      "SELECT id, user_id FROM employees WHERE org_id = ? AND email = ?",
    ).bind(invite.org_id, email).first<Record<string, unknown>>()
    : null;
  if (employee?.user_id) {
    return c.json({ error: "This employee profile is already linked to another account" }, 409);
  }

  let passwordHash: string;
  try {
    passwordHash = await hashPassword(generateRandomPassword());
  } catch (error) {
    console.error("Password hashing failed during invitation acceptance", error instanceof Error ? error.name : "UnknownError");
    return c.json(
      { error: "Account security is temporarily unavailable", code: "PASSWORD_HASH_UNAVAILABLE" },
      503,
    );
  }

  const statements: D1PreparedStatement[] = [
    c.env.DB.prepare(
      "INSERT INTO users (id, email, name, password_hash, role, status, org_id, must_change_password, created_at) VALUES (?, ?, ?, ?, ?, 'active', ?, 1, ?)",
    ).bind(userId, email, displayName, passwordHash, role, invite.org_id, nowIso()),
  ];

  if (role === "employee") {
    const inviteRoleTitle = String(invite.role_title || "");
    const inviteEmployeeType = normalizeEmployeeType(invite.employee_type) || "employee";
    const employeeName = invitePrefillName || displayName;
    if (employee) {
      statements.push(c.env.DB.prepare(
        `UPDATE employees SET
           user_id = ?,
           name = CASE WHEN ? != '' THEN ? ELSE name END,
           role_title = CASE WHEN ? != '' THEN ? ELSE role_title END,
           employee_type = ?
         WHERE id = ? AND org_id = ?`,
      ).bind(
        userId,
        employeeName,
        employeeName,
        inviteRoleTitle,
        inviteRoleTitle,
        inviteEmployeeType,
        employee.id,
        invite.org_id,
      ));
    } else {
      statements.push(c.env.DB.prepare(
        `INSERT INTO employees (
           id, org_id, user_id, email, name, role_title, location, employee_type,
           token, network, amount_minor, endpoint, status, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, '', ?, 'USDC', 'Base', 0, '', 'pending', ?)`,
      ).bind(
        uuid(),
        invite.org_id,
        userId,
        email,
        employeeName,
        inviteRoleTitle,
        inviteEmployeeType,
        nowIso(),
      ));
    }
  }

  statements.push(
    c.env.DB.prepare("UPDATE invitations SET status = 'accepted' WHERE id = ? AND status = 'pending'").bind(invite.id),
    c.env.DB.prepare(
      "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'invite.accepted', ?)",
    ).bind(uuid(), invite.org_id, userId, `Accepted invitation for ${email}`),
  );
  await c.env.DB.batch(statements);

  const authUser = {
    id: userId,
    email,
    name: displayName,
    role,
    org_id: String(invite.org_id),
    wallet_address: null,
    wallet_verified: false,
    must_change_password: true,
  };
  const sessionToken = await signToken({ sub: userId, org: authUser.org_id, role }, c.env);
  setAuthCookie(c, sessionToken, c.env);
  return c.json({ ok: true, user: authUser });
});

// Admin: resend / revoke
inviteRoutes.post("/:id/resend", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const id = c.req.param("id");
  const invite = await c.env.DB.prepare("SELECT * FROM invitations WHERE id = ? AND org_id = ?").bind(id, user.org_id).first<Record<string, unknown>>();
  if (!invite) return c.json({ error: "Invitation not found" }, 404);
  if (invite.status === "accepted") return c.json({ error: "Accepted invitations cannot be resent" }, 409);
  if (invite.status === "revoked") return c.json({ error: "Revoked invitations cannot be resent" }, 409);
  const token = uuid().replace(/-/g, "") + uuid().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const inviteUrl = `${c.env.APP_URL}/invite/${token}`;
  const org = await c.env.DB.prepare("SELECT name FROM organizations WHERE id = ?").bind(user.org_id).first<{ name: string }>();
  const mail = await sendInviteEmail(c.env, { to: String(invite.email), inviteUrl, orgName: org?.name || "", inviterName: user.name, role: String(invite.role) });
  if (!mail.ok) {
    await c.env.DB.prepare(
      "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'invite.email_failed', ?)",
    ).bind(uuid(), user.org_id, user.id, `Email delivery failed for ${String(invite.email)}`).run();
    return c.json({
      error: `Email delivery failed. ${mail.error || "Check the email provider configuration and retry."}`,
      code: "INVITE_EMAIL_FAILED",
    }, 502);
  }
  await c.env.DB.prepare("UPDATE invitations SET token = ?, status = 'pending', expires_at = ? WHERE id = ?").bind(token, expiresAt, id).run();
  await c.env.DB.prepare(
    "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'invite.resent', ?)",
  ).bind(uuid(), user.org_id, user.id, `Resent invitation to ${String(invite.email)}`).run();
  return c.json({ ok: true, mail, inviteUrl: mail.mock ? inviteUrl : undefined });
});

inviteRoutes.post("/:id/revoke", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const id = c.req.param("id");
  await c.env.DB.prepare("UPDATE invitations SET status = 'revoked' WHERE id = ? AND org_id = ?").bind(id, user.org_id).run();
  return c.json({ ok: true });
});
