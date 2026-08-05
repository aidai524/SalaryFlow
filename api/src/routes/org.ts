// Organization info + employee directory (admin)

import { Hono } from "hono";
import { requireRole, type AppEnv } from "../middleware";
import { nowIso, uuid, type AuthUser } from "../types";

export const orgRoutes = new Hono<AppEnv>();

orgRoutes.get("/", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const org = await c.env.DB.prepare("SELECT id, name, country, created_at FROM organizations WHERE id = ?").bind(user.org_id).first();
  const members = await c.env.DB.prepare(
    "SELECT id, name, email, role, status, wallet_address FROM users WHERE org_id = ? ORDER BY created_at",
  ).bind(user.org_id).all<Record<string, unknown>>();
  const inviteCount = await c.env.DB.prepare(
    "SELECT COUNT(*) as n FROM invitations WHERE org_id = ? AND status = 'pending'",
  ).bind(user.org_id).first<{ n: number }>();
  return c.json({ org, members: members.results, pendingInvites: Number(inviteCount?.n || 0) });
});

// Update organization name / country (admin)
orgRoutes.patch("/", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const body = await c.req.json().catch(() => null);
  const name = body?.name !== undefined ? String(body.name).trim() : undefined;
  const country = body?.country !== undefined ? String(body.country).trim() : undefined;
  if (name === "" ) return c.json({ error: "Organization name cannot be empty" }, 400);
  const fields: string[] = [];
  const values: unknown[] = [];
  if (name !== undefined) { fields.push("name = ?"); values.push(name); }
  if (country !== undefined) { fields.push("country = ?"); values.push(country || null); }
  if (fields.length === 0) return c.json({ error: "Nothing to update" }, 400);
  values.push(user.org_id);
  await c.env.DB.prepare(`UPDATE organizations SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
  await c.env.DB.prepare(
    "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'org.updated', ?)",
  ).bind(uuid(), user.org_id, user.id, name ? `Name → ${name}` : "Country updated").run();
  const org = await c.env.DB.prepare("SELECT id, name, country, created_at FROM organizations WHERE id = ?").bind(user.org_id).first();
  return c.json({ org });
});

// Employee directory (linked to org; can be pre-provisioned before account acceptance)
orgRoutes.get("/employees", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const rows = await c.env.DB.prepare(
    "SELECT id, user_id, name, role_title, location, token, network, amount, endpoint, status, last_paid_at, created_at FROM employees WHERE org_id = ? ORDER BY created_at",
  ).bind(user.org_id).all<Record<string, unknown>>();
  return c.json({ employees: rows.results });
});

orgRoutes.post("/employees", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const body = await c.req.json().catch(() => null);
  const name = String(body?.name || "").trim();
  if (!name) return c.json({ error: "Name is required" }, 400);
  const id = uuid();
  const token = body?.token === "USDT" ? "USDT" : "USDC";
  const network = String(body?.network || "Base");
  const amount = Number(body?.amount || 0);
  await c.env.DB.prepare(
    "INSERT INTO employees (id, org_id, name, role_title, location, token, network, amount, endpoint, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)",
  ).bind(id, user.org_id, name, String(body?.role_title || ""), String(body?.location || ""), token, network, amount, String(body?.endpoint || ""), nowIso()).run();
  await c.env.DB.prepare(
    "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'employee.created', ?)",
  ).bind(uuid(), user.org_id, user.id, `Added employee ${name}`).run();
  const row = await c.env.DB.prepare("SELECT * FROM employees WHERE id = ?").bind(id).first();
  return c.json({ employee: row }, 201);
});

orgRoutes.patch("/employees/:id", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const key of ["name", "role_title", "location", "token", "network", "endpoint", "status"] as const) {
    if (body?.[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(body[key]);
    }
  }
  if (body?.amount !== undefined) {
    fields.push("amount = ?");
    values.push(Number(body.amount));
  }
  if (fields.length === 0) return c.json({ error: "Nothing to update" }, 400);
  values.push(id);
  await c.env.DB.prepare(`UPDATE employees SET ${fields.join(", ")} WHERE id = ? AND org_id = ?`).bind(...values, user.org_id).run();
  const row = await c.env.DB.prepare("SELECT * FROM employees WHERE id = ?").bind(id).first();
  return c.json({ employee: row });
});

orgRoutes.delete("/employees/:id", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  await c.env.DB.prepare("DELETE FROM employees WHERE id = ? AND org_id = ?").bind(c.req.param("id"), user.org_id).run();
  return c.json({ ok: true });
});
