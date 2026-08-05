// Chain records (admin view) + employee self-service (own payout, records, consents)

import { Hono } from "hono";
import { requireRole, type AppEnv } from "../middleware";
import { nowIso, uuid, type AuthUser } from "../types";

export const recordRoutes = new Hono<AppEnv>();

// Admin: all chain records for org
recordRoutes.get("/", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const rows = await c.env.DB.prepare(
    "SELECT * FROM chain_records WHERE org_id = ? ORDER BY quote_at DESC",
  ).bind(user.org_id).all<Record<string, unknown>>();
  return c.json({ records: rows.results });
});

// Employee: own payment records (via linked employee profile)
recordRoutes.get("/me", requireRole("employee"), async (c) => {
  const user = c.get("user") as AuthUser;
  const emp = await c.env.DB.prepare("SELECT id FROM employees WHERE user_id = ?").bind(user.id).first<{ id: string }>();
  if (!emp) return c.json({ records: [] });
  const rows = await c.env.DB.prepare(
    "SELECT * FROM payrun_items WHERE employee_id = ? ORDER BY created_at DESC",
  ).bind(emp.id).all<Record<string, unknown>>();
  return c.json({ records: rows.results });
});

// Employee: own payout method
recordRoutes.get("/me/payout", requireRole("employee"), async (c) => {
  const user = c.get("user") as AuthUser;
  const emp = await c.env.DB.prepare(
    "SELECT id, name, token, network, amount, endpoint, status, last_paid_at FROM employees WHERE user_id = ?",
  ).bind(user.id).first();
  if (!emp) return c.json({ payout: null });
  return c.json({ payout: emp });
});

recordRoutes.put("/me/payout", requireRole("employee"), async (c) => {
  const user = c.get("user") as AuthUser;
  const body = await c.req.json().catch(() => null);
  const emp = await c.env.DB.prepare("SELECT id FROM employees WHERE user_id = ?").bind(user.id).first<{ id: string }>();
  if (!emp) return c.json({ error: "No employee profile linked to this account" }, 404);
  const token = body?.token === "USDT" ? "USDT" : "USDC";
  const network = String(body?.network || "Base");
  const endpoint = String(body?.endpoint || "");
  // changing payout details requires reverification
  await c.env.DB.prepare(
    "UPDATE employees SET token = ?, network = ?, endpoint = ?, status = 'update_required' WHERE id = ?",
  ).bind(token, network, endpoint, emp.id).run();
  return c.json({ ok: true });
});

// Employee: sign stablecoin payout consent (demo — stores record)
recordRoutes.post("/consents", requireRole("employee"), async (c) => {
  const user = c.get("user") as AuthUser;
  const body = await c.req.json().catch(() => null);
  const emp = await c.env.DB.prepare("SELECT id FROM employees WHERE user_id = ?").bind(user.id).first<{ id: string | null }>();
  await c.env.DB.prepare(
    "INSERT INTO consents (id, org_id, user_id, employee_id, signed_at, payload) VALUES (?, ?, ?, ?, ?, ?)",
  ).bind(uuid(), user.org_id, user.id, emp?.id ?? null, nowIso(), JSON.stringify(body || {})).run();
  return c.json({ ok: true, signedAt: nowIso() });
});

recordRoutes.get("/consents/me", requireRole("employee"), async (c) => {
  const user = c.get("user") as AuthUser;
  const row = await c.env.DB.prepare("SELECT id, signed_at FROM consents WHERE user_id = ?").bind(user.id).first();
  return c.json({ signed: !!row, signedAt: row ? String(row.signed_at) : null });
});

// Wallet binding (admin and employee both may bind an EVM wallet)
recordRoutes.put("/wallet", requireRole("admin", "employee"), async (c) => {
  const user = c.get("user") as AuthUser;
  const body = await c.req.json().catch(() => null);
  const address = String(body?.address || "");
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return c.json({ error: "Invalid EVM address" }, 400);
  await c.env.DB.prepare("UPDATE users SET wallet_address = ?, wallet_verified_at = ? WHERE id = ?").bind(address, nowIso(), user.id).run();
  return c.json({ ok: true, wallet_address: address });
});

recordRoutes.delete("/wallet", requireRole("admin", "employee"), async (c) => {
  const user = c.get("user") as AuthUser;
  await c.env.DB.prepare("UPDATE users SET wallet_address = NULL, wallet_verified_at = NULL WHERE id = ?").bind(user.id).run();
  return c.json({ ok: true });
});
