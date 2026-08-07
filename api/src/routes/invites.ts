// Invitations: admin creates (email + role), employee accepts (creates account or links existing)

import { Hono } from "hono";
import { hashPassword, signToken, verifyPassword } from "../crypto";
import { requireRole, setAuthCookie, type AppEnv } from "../middleware";
import { sendInviteEmail } from "../mail";
import { nowIso, uuid, type AuthUser } from "../types";

export const inviteRoutes = new Hono<AppEnv>();

// Admin: list invitations for org
inviteRoutes.get("/", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const rows = await c.env.DB.prepare(
    "SELECT id, email, role, status, expires_at, created_at FROM invitations WHERE org_id = ? ORDER BY created_at DESC",
  ).bind(user.org_id).all<Record<string, unknown>>();
  return c.json({ invitations: rows.results });
});

// Admin: create invitation
inviteRoutes.post("/", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const body = await c.req.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  const role = body?.role === "admin" ? "admin" : "employee";
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
    "INSERT INTO invitations (id, org_id, email, role, token, invited_by, status, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)",
  ).bind(id, user.org_id, email, role, token, user.id, expiresAt, now).run();

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

  if (!mail.ok) {
    await c.env.DB.prepare(
      "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'invite.email_failed', ?)",
    ).bind(uuid(), user.org_id, user.id, `Email delivery failed for ${email}`).run();
    return c.json({
      error: `Invitation created, but email delivery failed. ${mail.error || "Check the email provider configuration and retry."}`,
      code: "INVITE_EMAIL_FAILED",
      invitation: { id, email, role, status: "pending", expires_at: expiresAt },
    }, 502);
  }

  return c.json({ invitation: { id, email, role, status: "pending", expires_at: expiresAt }, mail, inviteUrl: mail.mock ? inviteUrl : undefined }, 201);
});

// Public: resolve an invitation token (used by invite page)
inviteRoutes.get("/resolve/:token", async (c) => {
  const token = c.req.param("token");
  const row = await c.env.DB.prepare(
    "SELECT id, org_id, email, role, status, expires_at FROM invitations WHERE token = ?",
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
    invitation: { email: row.email, role: row.role, orgName: org?.name || "", accountExists: !!existingAccount },
  });
});

// Public: accept invitation — creates account (or links existing), binds to org
inviteRoutes.post("/accept", async (c) => {
  const body = await c.req.json().catch(() => null);
  const token = String(body?.token || "");
  const name = String(body?.name || "").trim();
  const password = String(body?.password || "");
  const email = String(body?.email || "").trim().toLowerCase();

  const invite = await c.env.DB.prepare(
    "SELECT id, org_id, email, role, status, expires_at FROM invitations WHERE token = ?",
  ).bind(token).first<Record<string, unknown>>();
  if (!invite) return c.json({ error: "Invitation not found" }, 404);
  if (invite.status !== "pending") return c.json({ error: "This invitation is no longer valid" }, 410);
  if (new Date(String(invite.expires_at)).getTime() < Date.now()) {
    await c.env.DB.prepare("UPDATE invitations SET status = 'expired' WHERE id = ?").bind(invite.id).run();
    return c.json({ error: "This invitation has expired" }, 410);
  }
  if (email !== String(invite.email)) return c.json({ error: "Email does not match the invitation" }, 400);
  if (password.length < 8) return c.json({ error: "Password must be at least 8 characters" }, 400);
  const role = invite.role === "admin" ? "admin" : "employee";
  const existing = await c.env.DB.prepare(
    "SELECT id, name, password_hash, org_id, wallet_address, wallet_verified_at FROM users WHERE email = ?",
  ).bind(email).first<Record<string, unknown>>();

  if (existing?.org_id === invite.org_id) return c.json({ error: "This account is already a member" }, 409);
  if (existing?.org_id && existing.org_id !== invite.org_id) {
    return c.json({ error: "This account belongs to another organization; multi-workspace accounts are not supported yet" }, 409);
  }
  if (existing && !(await verifyPassword(password, String(existing.password_hash)))) {
    return c.json({ error: "Invalid password for the existing account" }, 401);
  }
  if (!existing && !name) return c.json({ error: "Name is required" }, 400);

  const userId = existing ? String(existing.id) : uuid();
  const displayName = existing ? String(existing.name) : name;
  const employee = role === "employee"
    ? await c.env.DB.prepare(
      "SELECT id, user_id FROM employees WHERE org_id = ? AND email = ?",
    ).bind(invite.org_id, email).first<Record<string, unknown>>()
    : null;
  if (employee?.user_id && employee.user_id !== userId) {
    return c.json({ error: "This employee profile is already linked to another account" }, 409);
  }

  const statements: D1PreparedStatement[] = [];
  if (existing) {
    statements.push(c.env.DB.prepare(
      "UPDATE users SET org_id = ?, role = ?, status = 'active', updated_at = ? WHERE id = ?",
    ).bind(invite.org_id, role, nowIso(), userId));
  } else {
    let passwordHash: string;
    try {
      passwordHash = await hashPassword(password);
    } catch (error) {
      console.error("Password hashing failed during invitation acceptance", error instanceof Error ? error.name : "UnknownError");
      return c.json(
        { error: "Account security is temporarily unavailable", code: "PASSWORD_HASH_UNAVAILABLE" },
        503,
      );
    }
    statements.push(c.env.DB.prepare(
      "INSERT INTO users (id, email, name, password_hash, role, status, org_id, created_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)",
    ).bind(userId, email, displayName, passwordHash, role, invite.org_id, nowIso()));
  }

  if (role === "employee") {
    if (employee) {
      statements.push(c.env.DB.prepare(
        "UPDATE employees SET user_id = ?, name = ? WHERE id = ? AND org_id = ?",
      ).bind(userId, displayName, employee.id, invite.org_id));
    } else {
      statements.push(c.env.DB.prepare(
        "INSERT INTO employees (id, org_id, user_id, email, name, role_title, location, token, network, amount_minor, endpoint, status, created_at) VALUES (?, ?, ?, ?, ?, '', '', 'USDC', 'Base', 0, '', 'pending', ?)",
      ).bind(uuid(), invite.org_id, userId, email, displayName, nowIso()));
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
    wallet_address: existing?.wallet_address ? String(existing.wallet_address) : null,
    wallet_verified: !!existing?.wallet_verified_at,
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
