// Auth routes: register (creates org for first admin), login, logout, me

import { Hono } from "hono";
import { hashPassword, signToken, verifyPassword } from "../crypto";
import { authMiddleware, clearAuthCookie, loadUser, setAuthCookie, type AppEnv } from "../middleware";
import { nowIso, uuid } from "../types";

export const authRoutes = new Hono<AppEnv>();

authRoutes.post("/register", async (c) => {
  const body = await c.req.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  const name = String(body?.name || "").trim();
  const orgName = String(body?.orgName || "").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: "A valid email is required" }, 400);
  if (password.length < 8) return c.json({ error: "Password must be at least 8 characters" }, 400);
  if (!name) return c.json({ error: "Name is required" }, 400);
  if (!orgName) return c.json({ error: "Organization name is required" }, 400);

  const existing = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) return c.json({ error: "An account with this email already exists" }, 409);

  const userId = uuid();
  const orgId = uuid();
  const passwordHash = await hashPassword(password);
  const now = nowIso();

  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)").bind(orgId, orgName, now),
    c.env.DB.prepare(
      "INSERT INTO users (id, email, name, password_hash, role, status, org_id, created_at) VALUES (?, ?, ?, ?, 'admin', 'active', ?, ?)",
    ).bind(userId, email, name, passwordHash, orgId, now),
  ]);

  const token = await signToken({ sub: userId, org: orgId, role: "admin" }, c.env);
  setAuthCookie(c, token, c.env);
  return c.json(
    { user: { id: userId, email, name, role: "admin", org_id: orgId, wallet_address: null, wallet_verified: false } },
    201,
  );
});

authRoutes.post("/login", async (c) => {
  const body = await c.req.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  const row = await c.env.DB.prepare(
    "SELECT id, email, name, password_hash, role, status, org_id, wallet_address, wallet_verified_at FROM users WHERE email = ?",
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
