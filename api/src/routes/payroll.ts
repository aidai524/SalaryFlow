// Payroll runs and items (admin)

import { Hono } from "hono";
import { requireRole, type AppEnv } from "../middleware";
import { parseTokenAmount } from "../money";
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
      "SELECT COUNT(*) as n, COALESCE(SUM(CASE WHEN token='USDC' THEN amount_minor END),0) as usdc_minor, COALESCE(SUM(CASE WHEN token='USDT' THEN amount_minor END),0) as usdt_minor FROM payrun_items WHERE run_id = ?",
    ).bind(run.id).first<{ n: number; usdc_minor: number; usdt_minor: number }>();
    result.push({ ...run, itemCount: Number(stats?.n || 0), usdcMinor: Number(stats?.usdc_minor || 0), usdtMinor: Number(stats?.usdt_minor || 0) });
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
    `SELECT pi.*,
            (SELECT pa.id FROM payment_attempts pa WHERE pa.item_id = pi.id ORDER BY pa.created_at DESC LIMIT 1) AS payment_attempt_id,
            (SELECT pa.state FROM payment_attempts pa WHERE pa.item_id = pi.id ORDER BY pa.created_at DESC LIMIT 1) AS payment_state,
            (SELECT pa.provider_status FROM payment_attempts pa WHERE pa.item_id = pi.id ORDER BY pa.created_at DESC LIMIT 1) AS provider_status
     FROM payrun_items pi WHERE pi.run_id = ? ORDER BY pi.created_at`,
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
  const amountMinor = parseTokenAmount(body?.amount);
  if (amountMinor === null) return c.json({ error: "A positive amount with at most 6 decimal places is required" }, 400);

  // pull defaults from employee directory if linked
  let employeeName = String(body?.employeeName || "");
  let token = body?.token === "USDT" ? "USDT" : "USDC";
  let network = String(body?.network || "Base");
  if (employeeId) {
    const emp = await c.env.DB.prepare("SELECT name, token, network, status FROM employees WHERE id = ? AND org_id = ?").bind(employeeId, user.org_id).first<Record<string, unknown>>();
    if (!emp) return c.json({ error: "Employee not found" }, 404);
    employeeName = String(emp.name);
    token = emp.token === "USDT" ? "USDT" : "USDC";
    network = String(emp.network || "Base");
  }
  if (!employeeName) return c.json({ error: "employeeName is required" }, 400);

  const id = uuid();
  await c.env.DB.prepare(
    "INSERT INTO payrun_items (id, run_id, employee_id, employee_name, amount_minor, token, network, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)",
  ).bind(id, runId, employeeId || null, employeeName, amountMinor, token, network, nowIso()).run();
  await c.env.DB.prepare("UPDATE payroll_runs SET updated_at = ? WHERE id = ?").bind(nowIso(), runId).run();
  const row = await c.env.DB.prepare("SELECT * FROM payrun_items WHERE id = ?").bind(id).first();
  return c.json({ item: row }, 201);
});

// Administrators may only manage pre-execution states. Processing and terminal
// states are derived from item payment attempts.
payrollRoutes.patch("/:id", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const status = String(body?.status || "");
  if (!["draft", "ready"].includes(status)) {
    return c.json({ error: "Processing and terminal run states are managed by the payment state machine" }, 400);
  }
  const current = await c.env.DB.prepare("SELECT status FROM payroll_runs WHERE id = ? AND org_id = ?")
    .bind(id, user.org_id).first<{ status: string }>();
  if (!current) return c.json({ error: "Run not found" }, 404);
  if (!["draft", "ready"].includes(current.status)) return c.json({ error: `Run in state ${current.status} cannot be changed manually` }, 409);
  await c.env.DB.prepare("UPDATE payroll_runs SET status = ?, updated_at = ? WHERE id = ? AND org_id = ?").bind(status, nowIso(), id, user.org_id).run();
  return c.json({ ok: true });
});
