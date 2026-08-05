// Payroll runs and items (admin)

import { Hono } from "hono";
import { requireRole, type AppEnv } from "../middleware";
import { nowIso, uuid, type AuthUser } from "../types";

export const payrollRoutes = new Hono<AppEnv>();

// List runs
payrollRoutes.get("/", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const runs = await c.env.DB.prepare(
    "SELECT id, label, pay_date, status, created_by, created_at, updated_at FROM payroll_runs WHERE org_id = ? ORDER BY created_at DESC",
  ).bind(user.org_id).all<Record<string, unknown>>();
  // attach totals + item counts
  const result = [];
  for (const run of runs.results) {
    const stats = await c.env.DB.prepare(
      "SELECT COUNT(*) as n, COALESCE(SUM(CASE WHEN token='USDC' THEN amount END),0) as usdc, COALESCE(SUM(CASE WHEN token='USDT' THEN amount END),0) as usdt FROM payrun_items WHERE run_id = ?",
    ).bind(run.id).first<{ n: number; usdc: number; usdt: number }>();
    result.push({ ...run, itemCount: Number(stats?.n || 0), usdc: Number(stats?.usdc || 0), usdt: Number(stats?.usdt || 0) });
  }
  return c.json({ runs: result });
});

// Create run
payrollRoutes.post("/", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const body = await c.req.json().catch(() => null);
  const label = String(body?.label || "").trim();
  const payDate = String(body?.payDate || "").trim();
  if (!label) return c.json({ error: "A run label is required" }, 400);
  const id = uuid();
  await c.env.DB.prepare(
    "INSERT INTO payroll_runs (id, org_id, label, pay_date, status, created_by, created_at) VALUES (?, ?, ?, ?, 'draft', ?, ?)",
  ).bind(id, user.org_id, label, payDate || nowIso().slice(0, 10), user.id, nowIso()).run();
  const row = await c.env.DB.prepare("SELECT * FROM payroll_runs WHERE id = ?").bind(id).first();
  return c.json({ run: row }, 201);
});

// Run detail with items
payrollRoutes.get("/:id", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const id = c.req.param("id");
  const run = await c.env.DB.prepare("SELECT * FROM payroll_runs WHERE id = ? AND org_id = ?").bind(id, user.org_id).first();
  if (!run) return c.json({ error: "Run not found" }, 404);
  const items = await c.env.DB.prepare(
    "SELECT * FROM payrun_items WHERE run_id = ? ORDER BY created_at",
  ).bind(id).all<Record<string, unknown>>();
  return c.json({ run, items: items.results });
});

// Add an item to a run (from employee directory or manual)
payrollRoutes.post("/:id/items", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const runId = c.req.param("id");
  const run = await c.env.DB.prepare("SELECT id, status FROM payroll_runs WHERE id = ? AND org_id = ?").bind(runId, user.org_id).first<{ id: string; status: string }>();
  if (!run) return c.json({ error: "Run not found" }, 404);
  if (run.status !== "draft") return c.json({ error: "Items can only be added to a draft run" }, 400);

  const body = await c.req.json().catch(() => null);
  const employeeId = String(body?.employeeId || "");
  const amount = Number(body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) return c.json({ error: "A valid amount is required" }, 400);

  // pull defaults from employee directory if linked
  let employeeName = String(body?.employeeName || "");
  let token = body?.token === "USDT" ? "USDT" : "USDC";
  let network = String(body?.network || "Base");
  if (employeeId) {
    const emp = await c.env.DB.prepare("SELECT name, token, network, status FROM employees WHERE id = ? AND org_id = ?").bind(employeeId, user.org_id).first<Record<string, unknown>>();
    if (emp) {
      employeeName = String(emp.name);
      token = emp.token === "USDT" ? "USDT" : "USDC";
      network = String(emp.network || "Base");
    }
  }
  if (!employeeName) return c.json({ error: "employeeName is required" }, 400);

  const id = uuid();
  await c.env.DB.prepare(
    "INSERT INTO payrun_items (id, run_id, employee_id, employee_name, amount, token, network, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)",
  ).bind(id, runId, employeeId || null, employeeName, amount, token, network, nowIso()).run();
  await c.env.DB.prepare("UPDATE payroll_runs SET updated_at = ? WHERE id = ?").bind(nowIso(), runId).run();
  const row = await c.env.DB.prepare("SELECT * FROM payrun_items WHERE id = ?").bind(id).first();
  return c.json({ item: row }, 201);
});

// Set run status (ready → paid happens via payment flow)
payrollRoutes.patch("/:id", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const status = String(body?.status || "");
  const allowed = ["draft", "ready", "paid", "failed", "partial"];
  if (!allowed.includes(status)) return c.json({ error: "Invalid status" }, 400);
  await c.env.DB.prepare("UPDATE payroll_runs SET status = ?, updated_at = ? WHERE id = ? AND org_id = ?").bind(status, nowIso(), id, user.org_id).run();
  return c.json({ ok: true });
});
