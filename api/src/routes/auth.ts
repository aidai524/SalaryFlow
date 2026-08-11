// Auth routes: register (creates org for first admin), login, logout, me, change-password

import { Hono } from "hono";
import { hashPassword, signToken, verifyPassword } from "../crypto";
import { authMiddleware, clearAuthCookie, loadUser, setAuthCookie, type AppEnv } from "../middleware";
import { nowIso, uuid } from "../types";

export const authRoutes = new Hono<AppEnv>();

function inviteRequired(env: { REGISTER_INVITE_REQUIRED?: string }): boolean {
  return String(env.REGISTER_INVITE_REQUIRED || "").trim().toLowerCase() === "true";
}

authRoutes.get("/registration", (c) => {
  return c.json({ inviteRequired: inviteRequired(c.env) });
});

authRoutes.post("/register", async (c) => {
  const body = await c.req.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  const name = String(body?.name || "").trim();
  const orgName = String(body?.orgName || "").trim();
  const inviteCode = String(body?.inviteCode || body?.invite_code || "").trim().toUpperCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: "A valid email is required" }, 400);
  if (password.length < 8) return c.json({ error: "Password must be at least 8 characters" }, 400);
  if (!name) return c.json({ error: "Name is required" }, 400);
  if (!orgName) return c.json({ error: "Organization name is required" }, 400);

  const requireInvite = inviteRequired(c.env);
  if (requireInvite && !inviteCode) {
    return c.json({ error: "Invite code is required", code: "INVITE_CODE_REQUIRED" }, 400);
  }

  const existing = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) return c.json({ error: "An account with this email already exists" }, 409);

  const userId = uuid();
  const orgId = uuid();
  let passwordHash: string;
  try {
    passwordHash = await hashPassword(password);
  } catch (error) {
    console.error("Password hashing failed during registration", error instanceof Error ? error.name : "UnknownError");
    return c.json(
      { error: "Account security is temporarily unavailable", code: "PASSWORD_HASH_UNAVAILABLE" },
      503,
    );
  }
  const now = nowIso();

  // Claim single-use invite before creating the account (race-safe).
  if (requireInvite) {
    const claim = await c.env.DB.prepare(
      "UPDATE register_invite_codes SET used_at = ?, used_by_user_id = ? WHERE upper(code) = ? AND used_at IS NULL",
    ).bind(now, userId, inviteCode).run();
    if (Number(claim.meta.changes || 0) !== 1) {
      return c.json({ error: "Invalid or already used invite code", code: "INVITE_CODE_INVALID" }, 400);
    }
  }

  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)").bind(orgId, orgName, now),
    c.env.DB.prepare(
      "INSERT INTO users (id, email, name, password_hash, role, status, org_id, must_change_password, created_at) VALUES (?, ?, ?, ?, 'admin', 'active', ?, 0, ?)",
    ).bind(userId, email, name, passwordHash, orgId, now),
  ]);

  const token = await signToken({ sub: userId, org: orgId, role: "admin" }, c.env);
  setAuthCookie(c, token, c.env);
  return c.json(
    {
      user: {
        id: userId,
        email,
        name,
        role: "admin",
        org_id: orgId,
        wallet_address: null,
        wallet_verified: false,
        must_change_password: false,
      },
    },
    201,
  );
});

authRoutes.post("/login", async (c) => {
  const body = await c.req.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  const row = await c.env.DB.prepare(
    "SELECT id, email, name, password_hash, role, status, org_id, wallet_address, wallet_verified_at, must_change_password FROM users WHERE email = ?",
  ).bind(email).first<Record<string, unknown>>();
  if (!row) return c.json({ error: "Invalid email or password" }, 401);
  if (row.status === "disabled") return c.json({ error: "This account is disabled" }, 403);
  const ok = await verifyPassword(password, String(row.password_hash));
  if (!ok) return c.json({ error: "Invalid email or password" }, 401);

  const user = {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    role: row.role as "admin" | "employee",
    org_id: row.org_id ? String(row.org_id) : null,
    wallet_address: row.wallet_address ? String(row.wallet_address) : null,
    wallet_verified: !!row.wallet_verified_at,
    must_change_password: !!row.must_change_password,
  };
  const token = await signToken({ sub: user.id, org: user.org_id, role: user.role }, c.env);
  setAuthCookie(c, token, c.env);
  await c.env.DB.prepare("UPDATE users SET updated_at = ? WHERE id = ?").bind(nowIso(), user.id).run();
  return c.json({ user });
});

authRoutes.post("/logout", (c) => {
  clearAuthCookie(c, c.env);
  return c.json({ ok: true });
});

// Authenticated endpoints
authRoutes.use("/me", authMiddleware);
authRoutes.use("/change-password", authMiddleware);

authRoutes.get("/me", async (c) => {
  const user = await loadUser(c);
  return c.json({ user });
});

authRoutes.patch("/me", async (c) => {
  const user = await loadUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.json().catch(() => null);
  const name = String(body?.name || "").trim();
  if (name) {
    await c.env.DB.prepare("UPDATE users SET name = ?, updated_at = ? WHERE id = ?").bind(name, nowIso(), user.id).run();
  }
  const fresh = await loadUser(c);
  return c.json({ user: fresh });
});

authRoutes.post("/change-password", async (c) => {
  const user = await loadUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const body = await c.req.json().catch(() => null);
  const currentPassword = String(body?.currentPassword || "");
  const newPassword = String(body?.newPassword || "");

  if (newPassword.length < 8) {
    return c.json({ error: "Password must be at least 8 characters" }, 400);
  }

  const row = await c.env.DB.prepare(
    "SELECT password_hash, must_change_password FROM users WHERE id = ?",
  ).bind(user.id).first<Record<string, unknown>>();
  if (!row) return c.json({ error: "Unauthorized" }, 401);

  const mustChange = !!row.must_change_password;
  if (!mustChange) {
    if (!currentPassword) return c.json({ error: "Current password is required" }, 400);
    const ok = await verifyPassword(currentPassword, String(row.password_hash));
    if (!ok) return c.json({ error: "Current password is incorrect" }, 401);
  }

  let passwordHash: string;
  try {
    passwordHash = await hashPassword(newPassword);
  } catch (error) {
    console.error("Password hashing failed during change-password", error instanceof Error ? error.name : "UnknownError");
    return c.json(
      { error: "Account security is temporarily unavailable", code: "PASSWORD_HASH_UNAVAILABLE" },
      503,
    );
  }

  await c.env.DB.prepare(
    "UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?",
  ).bind(passwordHash, nowIso(), user.id).run();

  const fresh = await loadUser(c);
  return c.json({ ok: true, user: fresh });
});
