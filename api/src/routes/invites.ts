// Invitations: admin creates (email + role), employee accepts (creates account or links existing)

import { Hono } from "hono";
import { hashPassword } from "../crypto";
import { requireRole, type AppEnv } from "../middleware";
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

  // prevent inviting an existing member
  const existingUser = await c.env.DB.prepare("SELECT id FROM users WHERE email = ? AND org_id = ?").bind(email, user.org_id).first();
  if (existingUser) return c.json({ error: "This person is already a member" }, 409);

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
  return c.json({
    invitation: { email: row.email, role: row.role, orgName: org?.name || "" },
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
  if (new Date(String(invite.expires_at)).getTime() < Date.now()) return c.json({ error: "This invitation has expired" }, 410);
  if (email !== String(invite.email)) return c.json({ error: "Email does not match the invitation" }, 400);
  if (password.length < 8) return c.json({ error: "Password must be at least 8 characters" }, 400);
  if (!name) return c.json({ error: "Name is required" }, 400);

  let userId = "";
  let existing = await c.env.DB.prepare("SELECT id, role, org_id FROM users WHERE email = ?").bind(email).first<Record<string, unknown>>();
  if (existing) {
    userId = String(existing.id);
    // Link existing account to this org; keep their role if admin, else adopt invited role
    const role = existing.role === "admin" ? "admin" : String(invite.role);
    await c.env.DB.prepare("UPDATE users SET org_id = ?, role = ?, status = 'active', updated_at = ? WHERE id = ?").bind(invite.org_id, role, nowIso(), userId).run();
  } else {
    userId = uuid();
    const passwordHash = await hashPassword(password);
    await c.env.DB.prepare(
      "INSERT INTO users (id, email, name, password_hash, role, status, org_id, created_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)",
    ).bind(userId, email, name, passwordHash, String(invite.role), invite.org_id, nowIso()).run();
  }

  await c.env.DB.prepare("UPDATE invitations SET status = 'accepted' WHERE id = ?").bind(invite.id).run();

  // Link employee profile row if one exists for this org+email
  const emp = await c.env.DB.prepare("SELECT id FROM employees WHERE org_id = ? AND name = ?").bind(invite.org_id, name).first<{ id: string }>();
  if (emp) {
    await c.env.DB.prepare("UPDATE employees SET user_id = ? WHERE id = ?").bind(userId, emp.id).run();
  }

  const role = existing && existing.role === "admin" ? "admin" : String(invite.role);
  return c.json({ ok: true, user: { id: userId, email, name, role, org_id: invite.org_id } });
});

// Admin: resend / revoke
inviteRoutes.post("/:id/resend", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const id = c.req.param("id");
  const invite = await c.env.DB.prepare("SELECT * FROM invitations WHERE id = ? AND org_id = ?").bind(id, user.org_id).first<Record<string, unknown>>();
  if (!invite) return c.json({ error: "Invitation not found" }, 404);
  const token = uuid().replace(/-/g, "") + uuid().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await c.env.DB.prepare("UPDATE invitations SET token = ?, status = 'pending', expires_at = ? WHERE id = ?").bind(token, expiresAt, id).run();
  const inviteUrl = `${c.env.APP_URL}/invite/${token}`;
  const org = await c.env.DB.prepare("SELECT name FROM organizations WHERE id = ?").bind(user.org_id).first<{ name: string }>();
  const mail = await sendInviteEmail(c.env, { to: String(invite.email), inviteUrl, orgName: org?.name || "", inviterName: user.name, role: String(invite.role) });
  return c.json({ ok: true, inviteUrl: mail.mock ? inviteUrl : undefined });
});

inviteRoutes.post("/:id/revoke", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const id = c.req.param("id");
  await c.env.DB.prepare("UPDATE invitations SET status = 'revoked' WHERE id = ? AND org_id = ?").bind(id, user.org_id).run();
  return c.json({ ok: true });
});
