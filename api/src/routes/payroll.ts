// Payroll runs and items (admin)

import { Hono } from "hono";
import { requireRole, type AppEnv } from "../middleware";
import { parseTokenAmount } from "../money";
import { addPayrollCadence, isDateOnly, normalizePayrollCadence, type RecurringPayrollCadence } from "../payroll-schedule";
import { normalizePayoutNetwork, normalizePayoutToken } from "../payout";
import { nowIso, uuid, type AuthUser } from "../types";

export const payrollRoutes = new Hono<AppEnv>();

async function paymentAttemptCount(db: D1Database, runId: string, itemId?: string): Promise<number> {
  const row = itemId
    ? await db.prepare("SELECT COUNT(*) AS n FROM payment_attempts WHERE run_id = ? AND item_id = ?").bind(runId, itemId).first<{ n: number }>()
    : await db.prepare("SELECT COUNT(*) AS n FROM payment_attempts WHERE run_id = ?").bind(runId).first<{ n: number }>();
  return Number(row?.n || 0);
}

// List runs
payrollRoutes.get("/", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const runs = await c.env.DB.prepare(
    `SELECT pr.id, pr.label, pr.pay_date, pr.status, pr.created_by, pr.created_at, pr.updated_at,
            pr.schedule_id, pr.source, COALESCE(ps.cadence, 'manual') AS cadence
     FROM payroll_runs pr
     LEFT JOIN payroll_schedules ps ON ps.id = pr.schedule_id
     WHERE pr.org_id = ? AND pr.archived_at IS NULL
     ORDER BY pr.pay_date DESC, pr.created_at DESC`,
  ).bind(user.org_id).all<Record<string, unknown>>();
  // attach totals + item counts
  const result = [];
  for (const run of runs.results) {
    const stats = await c.env.DB.prepare(
      "SELECT COUNT(*) as n, COALESCE(SUM(CASE WHEN token='USDC' THEN amount_minor END),0) as usdc_minor, COALESCE(SUM(CASE WHEN token='USDT' THEN amount_minor END),0) as usdt_minor FROM payrun_items WHERE run_id = ? AND removed_at IS NULL",
    ).bind(run.id).first<{ n: number; usdc_minor: number; usdt_minor: number }>();
    result.push({ ...run, itemCount: Number(stats?.n || 0), usdcMinor: Number(stats?.usdc_minor || 0), usdtMinor: Number(stats?.usdt_minor || 0) });
  }
  return c.json({ runs: result });
});

// List recurring schedules. Schedules only create draft runs; they never
// approve or execute a payment.
payrollRoutes.get("/schedules", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const rows = await c.env.DB.prepare(
    "SELECT id, name, cadence, next_pay_date, last_generated_date, draft_lead_days, active, created_at, updated_at FROM payroll_schedules WHERE org_id = ? AND archived_at IS NULL ORDER BY created_at DESC",
  ).bind(user.org_id).all<Record<string, unknown>>();
  return c.json({ schedules: rows.results.map((row) => ({ ...row, active: !!row.active })) });
});

payrollRoutes.patch("/schedules/:id", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const schedule = await c.env.DB.prepare(
    "SELECT id, name, cadence, next_pay_date, active FROM payroll_schedules WHERE id = ? AND org_id = ? AND archived_at IS NULL",
  ).bind(id, user.org_id).first<Record<string, unknown>>();
  if (!schedule) return c.json({ error: "Payroll schedule not found" }, 404);
  const name = body?.name === undefined ? String(schedule.name) : String(body.name).trim();
  const cadence = body?.cadence === undefined ? String(schedule.cadence) : normalizePayrollCadence(body.cadence);
  const nextPayDate = body?.nextPayDate === undefined ? String(schedule.next_pay_date) : String(body.nextPayDate).trim();
  const active = typeof body?.active === "boolean" ? body.active : !!schedule.active;
  if (!name) return c.json({ error: "A schedule name is required" }, 400);
  if (!cadence || cadence === "manual") return c.json({ error: "Choose a recurring payroll frequency" }, 400);
  if (!isDateOnly(nextPayDate)) return c.json({ error: "Choose a valid next pay date" }, 400);
  const anchorDay = cadence === "monthly" ? Number(nextPayDate.slice(-2)) : null;
  const timestamp = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE payroll_schedules SET name = ?, cadence = ?, anchor_day = ?, next_pay_date = ?, active = ?, updated_at = ? WHERE id = ? AND org_id = ? AND archived_at IS NULL",
    ).bind(name, cadence, anchorDay, nextPayDate, active ? 1 : 0, timestamp, id, user.org_id),
    c.env.DB.prepare(
      "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'payroll.schedule_updated', ?)",
    ).bind(uuid(), user.org_id, user.id, `Updated payroll schedule ${id}: ${name}, ${cadence}, next ${nextPayDate}, ${active ? "active" : "paused"}`),
  ]);
  return c.json({ schedule: { ...schedule, name, cadence, next_pay_date: nextPayDate, active, updated_at: timestamp } });
});

payrollRoutes.delete("/schedules/:id", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const id = c.req.param("id");
  const schedule = await c.env.DB.prepare(
    "SELECT id, name FROM payroll_schedules WHERE id = ? AND org_id = ? AND archived_at IS NULL",
  ).bind(id, user.org_id).first<Record<string, unknown>>();
  if (!schedule) return c.json({ error: "Payroll schedule not found" }, 404);
  const timestamp = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE payroll_schedules SET active = 0, archived_at = ?, archived_by = ?, updated_at = ? WHERE id = ? AND org_id = ? AND archived_at IS NULL",
    ).bind(timestamp, user.id, timestamp, id, user.org_id),
    c.env.DB.prepare(
      "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'payroll.schedule_archived', ?)",
    ).bind(uuid(), user.org_id, user.id, `Archived payroll schedule ${id}: ${String(schedule.name)}`),
  ]);
  return c.json({ ok: true, archivedAt: timestamp });
});

// Create run
payrollRoutes.post("/", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const body = await c.req.json().catch(() => null);
  const label = String(body?.label || "").trim();
  const payDate = String(body?.payDate || "").trim() || nowIso().slice(0, 10);
  const cadence = normalizePayrollCadence(body?.cadence);
  if (!label) return c.json({ error: "A run label is required" }, 400);
  if (!isDateOnly(payDate)) return c.json({ error: "Choose a valid pay date" }, 400);
  if (!cadence) return c.json({ error: "Choose a supported payroll frequency" }, 400);
  const id = uuid();
  const timestamp = nowIso();
  let scheduleId: string | null = null;
  let runLabel = label;
  const statements: D1PreparedStatement[] = [];
  if (cadence !== "manual") {
    scheduleId = uuid();
    runLabel = `${label} · ${payDate}`;
    const anchorDay = cadence === "monthly" ? Number(payDate.slice(-2)) : null;
    const nextPayDate = addPayrollCadence(payDate, cadence as RecurringPayrollCadence, anchorDay);
    statements.push(c.env.DB.prepare(
      "INSERT INTO payroll_schedules (id, org_id, name, cadence, anchor_day, next_pay_date, last_generated_date, draft_lead_days, active, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 5, 1, ?, ?)",
    ).bind(scheduleId, user.org_id, label, cadence, anchorDay, nextPayDate, payDate, user.id, timestamp));
  }
  statements.push(
    c.env.DB.prepare(
      "INSERT INTO payroll_runs (id, org_id, label, pay_date, status, created_by, created_at, schedule_id, source) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?)",
    ).bind(id, user.org_id, runLabel, payDate, user.id, timestamp, scheduleId, scheduleId ? "schedule" : "manual"),
    c.env.DB.prepare(
      "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'payroll.run_created', ?)",
    ).bind(uuid(), user.org_id, user.id, `${scheduleId ? `Created ${cadence} schedule` : "Created manual run"} ${runLabel}`),
  );
  await c.env.DB.batch(statements);
  const row = await c.env.DB.prepare(
    "SELECT pr.*, COALESCE(ps.cadence, 'manual') AS cadence FROM payroll_runs pr LEFT JOIN payroll_schedules ps ON ps.id = pr.schedule_id WHERE pr.id = ?",
  ).bind(id).first();
  return c.json({ run: row }, 201);
});

// Run detail with items
payrollRoutes.get("/:id", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const id = c.req.param("id");
  const run = await c.env.DB.prepare(
    "SELECT pr.*, COALESCE(ps.cadence, 'manual') AS cadence FROM payroll_runs pr LEFT JOIN payroll_schedules ps ON ps.id = pr.schedule_id WHERE pr.id = ? AND pr.org_id = ? AND pr.archived_at IS NULL",
  ).bind(id, user.org_id).first();
  if (!run) return c.json({ error: "Run not found" }, 404);
  const items = await c.env.DB.prepare(
    `SELECT pi.*,
            (SELECT pa.id FROM payment_attempts pa WHERE pa.item_id = pi.id ORDER BY pa.created_at DESC LIMIT 1) AS payment_attempt_id,
            (SELECT pa.state FROM payment_attempts pa WHERE pa.item_id = pi.id ORDER BY pa.created_at DESC LIMIT 1) AS payment_state,
            (SELECT pa.provider_status FROM payment_attempts pa WHERE pa.item_id = pi.id ORDER BY pa.created_at DESC LIMIT 1) AS provider_status
     FROM payrun_items pi WHERE pi.run_id = ? AND pi.removed_at IS NULL ORDER BY pi.created_at`,
  ).bind(id).all<Record<string, unknown>>();
  return c.json({ run, items: items.results });
});

type ImportRow = {
  employeeEmail?: unknown;
  employee_email?: unknown;
  employeeName?: unknown;
  employee_name?: unknown;
  amount?: unknown;
  token?: unknown;
  network?: unknown;
};

type ImportError = { row: number; field: string; message: string };

// Atomic JSON import after client-side CSV parsing. An email links the row to
// the employee directory; a blank email creates a clearly unpayable manual row.
payrollRoutes.post("/:id/items/import", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const runId = c.req.param("id");
  const run = await c.env.DB.prepare(
    "SELECT id, status FROM payroll_runs WHERE id = ? AND org_id = ? AND archived_at IS NULL",
  ).bind(runId, user.org_id).first<{ id: string; status: string }>();
  if (!run) return c.json({ error: "Run not found" }, 404);
  if (run.status !== "draft") return c.json({ error: "Payments can only be imported into a draft run" }, 400);
  const body = await c.req.json().catch(() => null);
  const rows = Array.isArray(body?.rows) ? body.rows as ImportRow[] : [];
  if (rows.length === 0) return c.json({ error: "Add at least one CSV row" }, 400);
  if (rows.length > 200) return c.json({ error: "Import up to 200 payments at a time" }, 400);

  const employeeRows = await c.env.DB.prepare(
    "SELECT id, email, name, token, network FROM employees WHERE org_id = ?",
  ).bind(user.org_id).all<Record<string, unknown>>();
  const employeesByEmail = new Map(employeeRows.results.map((employee) => [String(employee.email).toLowerCase(), employee]));
  const existingRows = await c.env.DB.prepare(
    "SELECT employee_id, employee_name FROM payrun_items WHERE run_id = ? AND removed_at IS NULL",
  ).bind(runId).all<Record<string, unknown>>();
  const usedEmployeeIds = new Set(existingRows.results.flatMap((row) => row.employee_id ? [String(row.employee_id)] : []));
  const usedManualNames = new Set(existingRows.results.filter((row) => !row.employee_id).map((row) => String(row.employee_name).trim().toLowerCase()));
  const errors: ImportError[] = [];
  const normalized: Array<{ employeeId: string | null; employeeName: string; amountMinor: number; token: string; network: string }> = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const email = String(row?.employeeEmail ?? row?.employee_email ?? "").trim().toLowerCase();
    const suppliedName = String(row?.employeeName ?? row?.employee_name ?? "").trim();
    const amountMinor = parseTokenAmount(row?.amount);
    if (amountMinor === null) errors.push({ row: rowNumber, field: "amount", message: "Use a positive amount with up to 6 decimal places" });

    if (email) {
      const employee = employeesByEmail.get(email);
      if (!employee) {
        errors.push({ row: rowNumber, field: "employee_email", message: "No employee matches this email" });
        return;
      }
      const employeeId = String(employee.id);
      if (usedEmployeeIds.has(employeeId)) {
        errors.push({ row: rowNumber, field: "employee_email", message: "This employee is already in the run or CSV" });
        return;
      }
      const employeeToken = String(employee.token);
      const employeeNetwork = String(employee.network);
      const suppliedToken = row?.token === undefined || String(row.token).trim() === "" ? employeeToken : normalizePayoutToken(row.token);
      const suppliedNetwork = row?.network === undefined || String(row.network).trim() === "" ? employeeNetwork : normalizePayoutNetwork(row.network);
      if (!suppliedToken) errors.push({ row: rowNumber, field: "token", message: "Use USDC or USDT" });
      else if (suppliedToken !== employeeToken) errors.push({ row: rowNumber, field: "token", message: `Use the employee payout token ${employeeToken}` });
      if (!suppliedNetwork) errors.push({ row: rowNumber, field: "network", message: "Use a supported EVM network" });
      else if (suppliedNetwork !== employeeNetwork) errors.push({ row: rowNumber, field: "network", message: `Use the employee payout network ${employeeNetwork}` });
      if (amountMinor !== null && suppliedToken === employeeToken && suppliedNetwork === employeeNetwork) {
        usedEmployeeIds.add(employeeId);
        normalized.push({ employeeId, employeeName: String(employee.name), amountMinor, token: employeeToken, network: employeeNetwork });
      }
      return;
    }

    if (!suppliedName) {
      errors.push({ row: rowNumber, field: "employee_name", message: "Add a name when employee_email is blank" });
      return;
    }
    const manualKey = suppliedName.toLowerCase();
    if (usedManualNames.has(manualKey)) {
      errors.push({ row: rowNumber, field: "employee_name", message: "This manual recipient is already in the run or CSV" });
      return;
    }
    const token = normalizePayoutToken(row?.token ?? "USDC");
    const network = normalizePayoutNetwork(row?.network ?? "Base");
    if (!token) errors.push({ row: rowNumber, field: "token", message: "Use USDC or USDT" });
    if (!network) errors.push({ row: rowNumber, field: "network", message: "Use a supported EVM network" });
    if (amountMinor !== null && token && network) {
      usedManualNames.add(manualKey);
      normalized.push({ employeeId: null, employeeName: suppliedName, amountMinor, token, network });
    }
  });

  if (errors.length > 0) {
    return c.json({ error: "Fix the CSV rows before importing", code: "PAYROLL_IMPORT_INVALID", errors }, 400);
  }

  const timestamp = nowIso();
  const statements: D1PreparedStatement[] = normalized.map((row) => c.env.DB.prepare(
    "INSERT INTO payrun_items (id, run_id, employee_id, employee_name, amount_minor, token, network, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)",
  ).bind(uuid(), runId, row.employeeId, row.employeeName, row.amountMinor, row.token, row.network, timestamp));
  statements.push(
    c.env.DB.prepare("UPDATE payroll_runs SET updated_at = ? WHERE id = ?").bind(timestamp, runId),
    c.env.DB.prepare(
      "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'payroll.items_imported', ?)",
    ).bind(uuid(), user.org_id, user.id, `Imported ${normalized.length} payroll payments into run ${runId}`),
  );
  await c.env.DB.batch(statements);
  const linkedCount = normalized.filter((row) => row.employeeId).length;
  return c.json({ ok: true, importedCount: normalized.length, linkedCount, manualCount: normalized.length - linkedCount }, 201);
});

// Add an item to a run (from employee directory or manual)
payrollRoutes.post("/:id/items", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const runId = c.req.param("id");
  const run = await c.env.DB.prepare("SELECT id, status FROM payroll_runs WHERE id = ? AND org_id = ? AND archived_at IS NULL").bind(runId, user.org_id).first<{ id: string; status: string }>();
  if (!run) return c.json({ error: "Run not found" }, 404);
  if (run.status !== "draft") return c.json({ error: "Items can only be added to a draft run" }, 400);

  const body = await c.req.json().catch(() => null);
  const employeeId = String(body?.employeeId || "");

  // pull defaults from employee directory if linked
  let employeeName = String(body?.employeeName || "");
  let token = body?.token === "USDT" ? "USDT" : "USDC";
  let network = String(body?.network || "Base");
  let defaultAmountMinor = 0;
  if (employeeId) {
    const emp = await c.env.DB.prepare("SELECT name, token, network, amount_minor FROM employees WHERE id = ? AND org_id = ?").bind(employeeId, user.org_id).first<Record<string, unknown>>();
    if (!emp) return c.json({ error: "Employee not found" }, 404);
    employeeName = String(emp.name);
    token = emp.token === "USDT" ? "USDT" : "USDC";
    network = String(emp.network || "Base");
    defaultAmountMinor = Number(emp.amount_minor || 0);
  }
  if (!employeeName) return c.json({ error: "employeeName is required" }, 400);
  const amountMinor = body?.amount === undefined || String(body.amount).trim() === ""
    ? defaultAmountMinor
    : parseTokenAmount(body.amount);
  if (!Number.isSafeInteger(amountMinor) || Number(amountMinor) <= 0) {
    return c.json({ error: "A positive amount with at most 6 decimal places is required" }, 400);
  }
  const duplicate = employeeId
    ? await c.env.DB.prepare("SELECT id FROM payrun_items WHERE run_id = ? AND employee_id = ? AND removed_at IS NULL").bind(runId, employeeId).first()
    : await c.env.DB.prepare("SELECT id FROM payrun_items WHERE run_id = ? AND employee_id IS NULL AND lower(employee_name) = lower(?) AND removed_at IS NULL").bind(runId, employeeName).first();
  if (duplicate) return c.json({ error: "This employee or manual recipient is already in the run" }, 409);

  const id = uuid();
  const timestamp = nowIso();
  const statements: D1PreparedStatement[] = [
    c.env.DB.prepare(
      "INSERT INTO payrun_items (id, run_id, employee_id, employee_name, amount_minor, token, network, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)",
    ).bind(id, runId, employeeId || null, employeeName, amountMinor, token, network, timestamp),
    c.env.DB.prepare("UPDATE payroll_runs SET updated_at = ? WHERE id = ?").bind(timestamp, runId),
  ];
  // Keep the employee profile default in sync with the latest drafted net amount.
  if (employeeId) {
    statements.push(
      c.env.DB.prepare("UPDATE employees SET amount_minor = ?, token = ?, network = ? WHERE id = ? AND org_id = ?")
        .bind(amountMinor, token, network, employeeId, user.org_id),
    );
  }
  await c.env.DB.batch(statements);
  const row = await c.env.DB.prepare("SELECT * FROM payrun_items WHERE id = ?").bind(id).first();
  return c.json({ item: row }, 201);
});

payrollRoutes.patch("/:id/items/:itemId", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const runId = c.req.param("id");
  const itemId = c.req.param("itemId");
  const run = await c.env.DB.prepare(
    "SELECT id, status FROM payroll_runs WHERE id = ? AND org_id = ? AND archived_at IS NULL",
  ).bind(runId, user.org_id).first<{ id: string; status: string }>();
  if (!run) return c.json({ error: "Run not found" }, 404);
  if (run.status !== "draft") return c.json({ error: "Only draft payroll payments can be edited" }, 409);
  const current = await c.env.DB.prepare(
    "SELECT * FROM payrun_items WHERE id = ? AND run_id = ? AND removed_at IS NULL",
  ).bind(itemId, runId).first<Record<string, unknown>>();
  if (!current) return c.json({ error: "Payroll payment not found" }, 404);
  if (String(current.status) !== "pending" || await paymentAttemptCount(c.env.DB, runId, itemId) > 0) {
    return c.json({ error: "A payment with execution history cannot be edited" }, 409);
  }
  const body = await c.req.json().catch(() => null);
  const changingRecipient = body && Object.prototype.hasOwnProperty.call(body, "employeeId");
  const requestedEmployeeId = changingRecipient ? String(body.employeeId || "") : String(current.employee_id || "");
  let employeeId: string | null = requestedEmployeeId || null;
  let employeeName = body?.employeeName === undefined ? String(current.employee_name) : String(body.employeeName).trim();
  let token = normalizePayoutToken(body?.token ?? current.token);
  let network = normalizePayoutNetwork(body?.network ?? current.network);
  if (employeeId) {
    const employee = await c.env.DB.prepare(
      "SELECT id, name, token, network FROM employees WHERE id = ? AND org_id = ?",
    ).bind(employeeId, user.org_id).first<Record<string, unknown>>();
    if (!employee) return c.json({ error: "Employee not found" }, 404);
    employeeName = String(employee.name);
    token = normalizePayoutToken(employee.token);
    network = normalizePayoutNetwork(employee.network);
  }
  if (!employeeName) return c.json({ error: "A recipient name is required" }, 400);
  if (!token) return c.json({ error: "Use USDC or USDT" }, 400);
  if (!network) return c.json({ error: "Use a supported EVM network" }, 400);
  const amountMinor = body?.amount === undefined ? Number(current.amount_minor) : parseTokenAmount(body.amount);
  if (!Number.isSafeInteger(amountMinor) || Number(amountMinor) <= 0) {
    return c.json({ error: "A positive amount with at most 6 decimal places is required" }, 400);
  }
  const duplicate = employeeId
    ? await c.env.DB.prepare("SELECT id FROM payrun_items WHERE run_id = ? AND employee_id = ? AND id <> ? AND removed_at IS NULL").bind(runId, employeeId, itemId).first()
    : await c.env.DB.prepare("SELECT id FROM payrun_items WHERE run_id = ? AND employee_id IS NULL AND lower(employee_name) = lower(?) AND id <> ? AND removed_at IS NULL").bind(runId, employeeName, itemId).first();
  if (duplicate) return c.json({ error: "This employee or manual recipient is already in the run" }, 409);
  const timestamp = nowIso();
  const statements: D1PreparedStatement[] = [
    c.env.DB.prepare(
      "UPDATE payrun_items SET employee_id = ?, employee_name = ?, amount_minor = ?, token = ?, network = ? WHERE id = ? AND run_id = ? AND removed_at IS NULL",
    ).bind(employeeId, employeeName, amountMinor, token, network, itemId, runId),
    c.env.DB.prepare("UPDATE payroll_runs SET updated_at = ? WHERE id = ?").bind(timestamp, runId),
    c.env.DB.prepare(
      "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'payroll.item_updated', ?)",
    ).bind(uuid(), user.org_id, user.id, `Updated payroll item ${itemId} in run ${runId}`),
  ];
  if (employeeId) {
    statements.push(
      c.env.DB.prepare("UPDATE employees SET amount_minor = ?, token = ?, network = ? WHERE id = ? AND org_id = ?")
        .bind(amountMinor, token, network, employeeId, user.org_id),
    );
  }
  await c.env.DB.batch(statements);
  const item = await c.env.DB.prepare("SELECT * FROM payrun_items WHERE id = ?").bind(itemId).first();
  return c.json({ item });
});

payrollRoutes.delete("/:id/items/:itemId", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const runId = c.req.param("id");
  const itemId = c.req.param("itemId");
  const run = await c.env.DB.prepare(
    "SELECT id, status FROM payroll_runs WHERE id = ? AND org_id = ? AND archived_at IS NULL",
  ).bind(runId, user.org_id).first<{ id: string; status: string }>();
  if (!run) return c.json({ error: "Run not found" }, 404);
  if (run.status !== "draft") return c.json({ error: "Only draft payroll payments can be removed" }, 409);
  const item = await c.env.DB.prepare(
    "SELECT id, employee_name, status FROM payrun_items WHERE id = ? AND run_id = ? AND removed_at IS NULL",
  ).bind(itemId, runId).first<Record<string, unknown>>();
  if (!item) return c.json({ error: "Payroll payment not found" }, 404);
  if (String(item.status) !== "pending" || await paymentAttemptCount(c.env.DB, runId, itemId) > 0) {
    return c.json({ error: "A payment with execution history cannot be removed" }, 409);
  }
  const timestamp = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE payrun_items SET removed_at = ?, removed_by = ? WHERE id = ? AND run_id = ? AND removed_at IS NULL",
    ).bind(timestamp, user.id, itemId, runId),
    c.env.DB.prepare("UPDATE payroll_runs SET updated_at = ? WHERE id = ?").bind(timestamp, runId),
    c.env.DB.prepare(
      "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'payroll.item_removed', ?)",
    ).bind(uuid(), user.org_id, user.id, `Removed payroll item ${itemId} (${String(item.employee_name)}) from run ${runId}`),
  ]);
  return c.json({ ok: true, removedAt: timestamp });
});

// Administrators may only manage pre-execution states. Processing and terminal
// states are derived from item payment attempts.
payrollRoutes.patch("/:id", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const current = await c.env.DB.prepare("SELECT id, label, pay_date, status, schedule_id FROM payroll_runs WHERE id = ? AND org_id = ? AND archived_at IS NULL")
    .bind(id, user.org_id).first<Record<string, unknown>>();
  if (!current) return c.json({ error: "Run not found" }, 404);
  const editsMetadata = body?.label !== undefined || body?.payDate !== undefined;
  if (editsMetadata && String(current.status) !== "draft") return c.json({ error: "Only draft payroll runs can be edited" }, 409);
  if (editsMetadata && await paymentAttemptCount(c.env.DB, id) > 0) return c.json({ error: "A payroll run with execution history cannot be edited" }, 409);
  const label = body?.label === undefined ? String(current.label) : String(body.label).trim();
  const payDate = body?.payDate === undefined ? String(current.pay_date) : String(body.payDate).trim();
  const status = body?.status === undefined ? String(current.status) : String(body.status);
  if (!label) return c.json({ error: "A run label is required" }, 400);
  if (!isDateOnly(payDate)) return c.json({ error: "Choose a valid pay date" }, 400);
  if (!["draft", "ready"].includes(status)) return c.json({ error: "Processing and terminal run states are managed by the payment state machine" }, 400);
  if (!["draft", "ready"].includes(String(current.status))) return c.json({ error: `Run in state ${String(current.status)} cannot be changed manually` }, 409);
  if (current.schedule_id && payDate !== String(current.pay_date)) {
    const conflict = await c.env.DB.prepare(
      "SELECT id FROM payroll_runs WHERE schedule_id = ? AND pay_date = ? AND id <> ?",
    ).bind(current.schedule_id, payDate, id).first();
    if (conflict) return c.json({ error: "This schedule already has a run on that pay date" }, 409);
  }
  const timestamp = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE payroll_runs SET label = ?, pay_date = ?, status = ?, updated_at = ? WHERE id = ? AND org_id = ? AND archived_at IS NULL")
      .bind(label, payDate, status, timestamp, id, user.org_id),
    c.env.DB.prepare(
      "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'payroll.run_updated', ?)",
    ).bind(uuid(), user.org_id, user.id, `Updated payroll run ${id}: ${label}, ${payDate}, ${status}`),
  ]);
  return c.json({ run: { ...current, label, pay_date: payDate, status, updated_at: timestamp } });
});

payrollRoutes.delete("/:id", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const id = c.req.param("id");
  const run = await c.env.DB.prepare(
    "SELECT id, label, status FROM payroll_runs WHERE id = ? AND org_id = ? AND archived_at IS NULL",
  ).bind(id, user.org_id).first<Record<string, unknown>>();
  if (!run) return c.json({ error: "Run not found" }, 404);
  if (String(run.status) !== "draft") return c.json({ error: "Only draft payroll runs can be archived" }, 409);
  if (await paymentAttemptCount(c.env.DB, id) > 0) return c.json({ error: "A payroll run with execution history cannot be archived" }, 409);
  const timestamp = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE payroll_runs SET archived_at = ?, archived_by = ?, updated_at = ? WHERE id = ? AND org_id = ? AND archived_at IS NULL",
    ).bind(timestamp, user.id, timestamp, id, user.org_id),
    c.env.DB.prepare(
      "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'payroll.run_archived', ?)",
    ).bind(uuid(), user.org_id, user.id, `Archived payroll run ${id}: ${String(run.label)}`),
  ]);
  return c.json({ ok: true, archivedAt: timestamp });
});
