// Organization info + employee directory (admin)

import { Hono } from "hono";
import { requireRole, type AppEnv } from "../middleware";
import { parseTokenAmount } from "../money";
import {
  isPaymentDateValidForSchedule,
  normalizeTeamPaymentDateKey,
  normalizeTeamPaymentSchedule,
  reminderLeadDaysForSchedule,
} from "../org-payment";
import { normalizePayoutAddress, normalizePayoutNetwork, normalizePayoutToken } from "../payout";
import { nowIso, uuid, type AuthUser } from "../types";

export const orgRoutes = new Hono<AppEnv>();

// Minimal workspace context shared by admins and employees. It intentionally
// excludes the member directory and other admin-only organization data.
// Phase 1: user.org_id is the single current workspace; future multi-org will
// select an activeOrgId from memberships instead of reading users.org_id alone.
orgRoutes.get("/context", requireRole("admin", "employee"), async (c) => {
  const user = c.get("user") as AuthUser;
  const org = await c.env.DB.prepare(
    `SELECT id, name, country, payment_cadence, payment_date_key, reminder_lead_days, payment_configured_at
     FROM organizations WHERE id = ?`,
  ).bind(user.org_id).first<{
    id: string;
    name: string;
    country: string | null;
    payment_cadence: string | null;
    payment_date_key: string | null;
    reminder_lead_days: number | null;
    payment_configured_at: string | null;
  }>();
  if (!org) return c.json({ error: "Organization not found" }, 404);
  const memberCount = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM users WHERE org_id = ? AND status = 'active'",
  ).bind(user.org_id).first<{ n: number }>();
  return c.json({
    org: {
      id: org.id,
      name: org.name,
      country: org.country,
      payment_cadence: org.payment_cadence,
      payment_date_key: org.payment_date_key,
      reminder_lead_days: org.reminder_lead_days,
      payment_configured_at: org.payment_configured_at,
    },
    memberCount: Number(memberCount?.n || 0),
    paymentConfigured: !!org.payment_configured_at,
  });
});

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

// Configure team payment preferences (Create Team onboarding).
// Does not create payroll_runs or payroll_schedules — separate from createRun.
orgRoutes.patch("/team", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const body = await c.req.json().catch(() => null);
  const paymentSchedule = normalizeTeamPaymentSchedule(body?.paymentSchedule);
  const paymentDate = normalizeTeamPaymentDateKey(body?.paymentDate);
  if (!paymentSchedule) return c.json({ error: "Choose a valid payment schedule" }, 400);
  if (!paymentDate) return c.json({ error: "Choose a valid payment date" }, 400);
  if (!isPaymentDateValidForSchedule(paymentSchedule, paymentDate)) {
    return c.json({ error: "Payment date does not match the selected schedule" }, 400);
  }

  const reminderLeadDays = reminderLeadDaysForSchedule(paymentSchedule);
  const configuredAt = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE organizations
       SET payment_cadence = ?, payment_date_key = ?, reminder_lead_days = ?, payment_configured_at = ?
       WHERE id = ?`,
    ).bind(paymentSchedule, paymentDate, reminderLeadDays, configuredAt, user.org_id),
    c.env.DB.prepare(
      "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'org.team_payment_updated', ?)",
    ).bind(
      uuid(),
      user.org_id,
      user.id,
      `Team payment → ${paymentSchedule}, ${paymentDate}, remind ${reminderLeadDays}d`,
    ),
  ]);

  const org = await c.env.DB.prepare(
    `SELECT id, name, country, payment_cadence, payment_date_key, reminder_lead_days, payment_configured_at
     FROM organizations WHERE id = ?`,
  ).bind(user.org_id).first();
  return c.json({ org });
});

// Employee directory (linked to org; can be pre-provisioned before account acceptance)
orgRoutes.get("/employees", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const rows = await c.env.DB.prepare(
    "SELECT id, user_id, email, name, role_title, location, token, network, amount_minor, endpoint, status, payout_verified_at, last_paid_at, created_at FROM employees WHERE org_id = ? ORDER BY created_at",
  ).bind(user.org_id).all<Record<string, unknown>>();
  return c.json({ employees: rows.results });
});

orgRoutes.post("/employees", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const body = await c.req.json().catch(() => null);
  const name = String(body?.name || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();
  if (!name) return c.json({ error: "Name is required" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: "A valid email is required" }, 400);
  const existing = await c.env.DB.prepare(
    "SELECT id FROM employees WHERE org_id = ? AND email = ?",
  ).bind(user.org_id, email).first();
  if (existing) return c.json({ error: "An employee with this email already exists" }, 409);
  const id = uuid();
  const token = normalizePayoutToken(body?.token ?? "USDC");
  const network = normalizePayoutNetwork(body?.network ?? "Base");
  if (!token || !network) return c.json({ error: "Unsupported payout token or network" }, 400);
  const endpointInput = String(body?.endpoint || "").trim();
  const endpoint = endpointInput ? normalizePayoutAddress(endpointInput) : "";
  if (endpoint === null) return c.json({ error: "A valid EVM payout address is required" }, 400);
  const amountMinor = body?.amount === undefined ? 0 : parseTokenAmount(body.amount, { allowZero: true });
  if (amountMinor === null) return c.json({ error: "Amount must have at most 6 decimal places" }, 400);
  await c.env.DB.prepare(
    "INSERT INTO employees (id, org_id, email, name, role_title, location, token, network, amount_minor, endpoint, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)",
  ).bind(id, user.org_id, email, name, String(body?.role_title || ""), String(body?.location || ""), token, network, amountMinor, endpoint, nowIso()).run();
  await c.env.DB.prepare(
    "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'employee.created', ?)",
  ).bind(uuid(), user.org_id, user.id, `Added employee ${name}`).run();
  const row = await c.env.DB.prepare("SELECT * FROM employees WHERE id = ? AND org_id = ?").bind(id, user.org_id).first();
  return c.json({ employee: row }, 201);
});

orgRoutes.patch("/employees/:id", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const fields: string[] = [];
  const values: unknown[] = [];
  if (body?.status !== undefined) {
    return c.json({ error: "Payout readiness is managed by wallet signature verification" }, 400);
  }
  if (body?.email !== undefined) {
    const email = String(body.email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: "A valid email is required" }, 400);
    const existing = await c.env.DB.prepare(
      "SELECT id FROM employees WHERE org_id = ? AND email = ? AND id != ?",
    ).bind(user.org_id, email, id).first();
    if (existing) return c.json({ error: "An employee with this email already exists" }, 409);
    fields.push("email = ?");
    values.push(email);
  }
  for (const key of ["name", "role_title", "location"] as const) {
    if (body?.[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(body[key]);
    }
  }
  let payoutChanged = false;
  if (body?.token !== undefined) {
    const token = normalizePayoutToken(body.token);
    if (!token) return c.json({ error: "Only USDC and USDT are supported" }, 400);
    fields.push("token = ?");
    values.push(token);
    payoutChanged = true;
  }
  if (body?.network !== undefined) {
    const network = normalizePayoutNetwork(body.network);
    if (!network) return c.json({ error: "Unsupported EVM payout network" }, 400);
    fields.push("network = ?");
    values.push(network);
    payoutChanged = true;
  }
  if (body?.endpoint !== undefined) {
    const endpointInput = String(body.endpoint).trim();
    const endpoint = endpointInput ? normalizePayoutAddress(endpointInput) : "";
    if (endpoint === null) return c.json({ error: "A valid EVM payout address is required" }, 400);
    fields.push("endpoint = ?");
    values.push(endpoint);
    payoutChanged = true;
  }
  if (payoutChanged) {
    fields.push("status = 'update_required'", "payout_verified_at = NULL");
  }
  if (body?.amount !== undefined) {
    const amountMinor = parseTokenAmount(body.amount, { allowZero: true });
    if (amountMinor === null) return c.json({ error: "Amount must have at most 6 decimal places" }, 400);
    fields.push("amount_minor = ?");
    values.push(amountMinor);
  }
  if (fields.length === 0) return c.json({ error: "Nothing to update" }, 400);
  values.push(id);
  await c.env.DB.prepare(`UPDATE employees SET ${fields.join(", ")} WHERE id = ? AND org_id = ?`).bind(...values, user.org_id).run();
  const row = await c.env.DB.prepare("SELECT * FROM employees WHERE id = ? AND org_id = ?").bind(id, user.org_id).first();
  return c.json({ employee: row });
});

orgRoutes.delete("/employees/:id", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  await c.env.DB.prepare("DELETE FROM employees WHERE id = ? AND org_id = ?").bind(c.req.param("id"), user.org_id).run();
  return c.json({ ok: true });
});
