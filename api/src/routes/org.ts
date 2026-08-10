// Organization info + employee directory (admin)

import { Hono } from "hono";
import { requireRole, type AppEnv } from "../middleware";
import { parseTokenAmount } from "../money";
import {
  isPaymentDateValidForSchedule,
  normalizeTeamPaymentDateKey,
  normalizeTeamPaymentSchedule,
  type TeamPaymentDateKey,
  type TeamPaymentSchedule,
} from "../org-payment";
import {
  daysUntilPayday,
  formatPaydayDisplay,
  listPeriodWindows,
  monthLabelForPayday,
  payrollTitleForPeriod,
  resolveCurrentPeriod,
  resolveNextPeriod,
  resolvePeriodFromKey,
  shortPeriodLabel,
} from "../pay-period";
import { normalizePayoutAddress, normalizePayoutNetwork, normalizePayoutToken } from "../payout";
import {
  normalizeEmployeeType,
  normalizeRoleTitle,
  parseContractorScheduleInput,
  resolveRecipientSchedule,
  type EmployeeType,
} from "../recipient";
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

  const configuredAt = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE organizations
       SET payment_cadence = ?, payment_date_key = ?, reminder_lead_days = NULL, payment_configured_at = ?
       WHERE id = ?`,
    ).bind(paymentSchedule, paymentDate, configuredAt, user.org_id),
    c.env.DB.prepare(
      "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'org.team_payment_updated', ?)",
    ).bind(
      uuid(),
      user.org_id,
      user.id,
      `Team payment → ${paymentSchedule}, ${paymentDate}`,
    ),
  ]);

  const org = await c.env.DB.prepare(
    `SELECT id, name, country, payment_cadence, payment_date_key, reminder_lead_days, payment_configured_at
     FROM organizations WHERE id = ?`,
  ).bind(user.org_id).first();
  return c.json({ org });
});

// Admin Pay home aggregation: team stats, recent recipients, high-priority alerts.
// Stats count employee_type = 'employee' only (contractor cadence lands later).
orgRoutes.get("/pay-overview", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const org = await c.env.DB.prepare(
    `SELECT id, name, payment_cadence, payment_date_key, payment_configured_at
     FROM organizations WHERE id = ?`,
  ).bind(user.org_id).first<{
    id: string;
    name: string;
    payment_cadence: string | null;
    payment_date_key: string | null;
    payment_configured_at: string | null;
  }>();
  if (!org) return c.json({ error: "Organization not found" }, 404);
  if (!org.payment_configured_at || !org.payment_cadence || !org.payment_date_key) {
    return c.json({ error: "Team payment preferences are not configured", code: "PAYMENT_NOT_CONFIGURED" }, 409);
  }

  const cadence = org.payment_cadence as TeamPaymentSchedule;
  const dateKey = org.payment_date_key as TeamPaymentDateKey;
  const now = new Date();
  const current = resolveCurrentPeriod(cadence, dateKey, now);

  const employees = await c.env.DB.prepare(
    `SELECT id, name, role_title, employee_type, amount_minor, token, network, endpoint,
            status, payout_verified_at, last_paid_at, created_at
     FROM employees WHERE org_id = ? ORDER BY created_at DESC`,
  ).bind(user.org_id).all<{
    id: string;
    name: string;
    role_title: string | null;
    employee_type: string;
    amount_minor: number;
    token: string;
    network: string;
    endpoint: string | null;
    status: string;
    payout_verified_at: string | null;
    last_paid_at: string | null;
    created_at: string;
  }>();

  const paidThisPeriod = await c.env.DB.prepare(
    `SELECT employee_id FROM employee_payments
     WHERE org_id = ? AND period_key = ? AND status = 'paid'`,
  ).bind(user.org_id, current.periodKey).all<{ employee_id: string }>();
  const paidIds = new Set(paidThisPeriod.results.map((r) => r.employee_id));

  const fullTime = employees.results.filter((e) => (e.employee_type || "employee") === "employee");
  let currentPayrollMinor = 0;
  let paidCount = 0;
  for (const emp of fullTime) {
    currentPayrollMinor += Number(emp.amount_minor || 0);
    if (paidIds.has(emp.id)) paidCount += 1;
  }

  const recipientsCount = fullTime.length;
  const progressDenom = recipientsCount || 1;
  const progress = Math.round((paidCount / progressDenom) * 100);

  const unverified = employees.results.filter((e) => !e.payout_verified_at || e.status !== "ready");
  const recent = employees.results.slice(0, 6).map((e) => ({
    id: e.id,
    name: e.name,
    role_title: e.role_title,
    employee_type: e.employee_type || "employee",
    verified: !!e.payout_verified_at && e.status === "ready",
    status: e.status,
    created_at: e.created_at,
  }));

  return c.json({
    org: { id: org.id, name: org.name },
    period: {
      periodKey: current.periodKey,
      payday: current.payday,
      paydayDisplay: formatPaydayDisplay(current.payday),
      cadence,
      monthLabel: monthLabelForPayday(current.payday),
    },
    stats: {
      currentPayrollMinor,
      recipientsCount,
      progress,
    },
    recipients: recent,
    highPriority: {
      verification: unverified.length > 0
        ? {
            count: unverified.length,
            names: unverified.slice(0, 2).map((e) => e.name),
          }
        : null,
    },
  });
});

// Admin Overview dashboard aggregation (period-aware stats + charts + upcoming).
orgRoutes.get("/overview", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const org = await c.env.DB.prepare(
    `SELECT id, name, payment_cadence, payment_date_key, payment_configured_at
     FROM organizations WHERE id = ?`,
  ).bind(user.org_id).first<{
    id: string;
    name: string;
    payment_cadence: string | null;
    payment_date_key: string | null;
    payment_configured_at: string | null;
  }>();
  if (!org) return c.json({ error: "Organization not found" }, 404);
  if (!org.payment_configured_at || !org.payment_cadence || !org.payment_date_key) {
    return c.json({ error: "Team payment preferences are not configured", code: "PAYMENT_NOT_CONFIGURED" }, 409);
  }

  const cadence = org.payment_cadence as TeamPaymentSchedule;
  const dateKey = org.payment_date_key as TeamPaymentDateKey;
  const now = new Date();
  const current = resolveCurrentPeriod(cadence, dateKey, now);

  const periodKeyParam = String(c.req.query("periodKey") || "").trim();
  let selected = current;
  if (periodKeyParam) {
    const resolved = resolvePeriodFromKey(cadence, dateKey, periodKeyParam);
    if (!resolved) return c.json({ error: "Invalid periodKey for team cadence" }, 400);
    selected = resolved;
  }

  const volumeRangeRaw = Number.parseInt(String(c.req.query("volumeRange") || "6"), 10);
  const volumeRange = volumeRangeRaw === 12 ? 12 : 6;

  const employees = await c.env.DB.prepare(
    `SELECT id, name, role_title, employee_type, amount_minor, token, network, endpoint,
            status, payout_verified_at, last_paid_at, created_at
     FROM employees WHERE org_id = ? ORDER BY created_at DESC`,
  ).bind(user.org_id).all<{
    id: string;
    name: string;
    role_title: string | null;
    employee_type: string;
    amount_minor: number;
    token: string;
    network: string;
    endpoint: string | null;
    status: string;
    payout_verified_at: string | null;
    last_paid_at: string | null;
    created_at: string;
  }>();

  const fullTime = employees.results.filter((e) => (e.employee_type || "employee") === "employee");
  const contractors = employees.results.filter((e) => (e.employee_type || "employee") === "contractor");

  const paidRows = await c.env.DB.prepare(
    `SELECT ep.id, ep.employee_id, ep.amount_minor, ep.period_key, ep.status, ep.paid_at, ep.created_at,
            ep.token, ep.network, e.name, e.role_title, e.employee_type
     FROM employee_payments ep
     JOIN employees e ON e.id = ep.employee_id
     WHERE ep.org_id = ?`,
  ).bind(user.org_id).all<{
    id: string;
    employee_id: string;
    amount_minor: number;
    period_key: string;
    status: string;
    paid_at: string | null;
    created_at: string;
    token: string;
    network: string;
    name: string;
    role_title: string | null;
    employee_type: string;
  }>();

  const paidIdsSelected = new Set<string>();
  let paidMinor = 0;
  let paidCount = 0;
  for (const row of paidRows.results) {
    if (row.period_key !== selected.periodKey || row.status !== "paid") continue;
    const emp = fullTime.find((e) => e.id === row.employee_id);
    if (!emp) continue;
    paidIdsSelected.add(row.employee_id);
    paidMinor += Number(row.amount_minor || 0);
    paidCount += 1;
  }

  let awaitingMinor = 0;
  let awaitingCount = 0;
  for (const emp of fullTime) {
    if (paidIdsSelected.has(emp.id)) continue;
    awaitingMinor += Number(emp.amount_minor || 0);
    awaitingCount += 1;
  }

  const recipientsCount = fullTime.length;
  const progress = Math.round((paidCount / (recipientsCount || 1)) * 100);
  const daysLeft = daysUntilPayday(selected.payday, now);

  // Volume: last N periods ending at current (real now), paid amounts for employees only.
  const volumeWindows = listPeriodWindows(cadence, dateKey, {
    direction: "past",
    count: volumeRange,
    from: current,
    now,
  });
  const paidByPeriod = new Map<string, number>();
  for (const row of paidRows.results) {
    if (row.status !== "paid") continue;
    const empType = row.employee_type || "employee";
    if (empType !== "employee") continue;
    paidByPeriod.set(row.period_key, (paidByPeriod.get(row.period_key) || 0) + Number(row.amount_minor || 0));
  }
  const volumeBars = volumeWindows.map((w, index) => {
    const amountMinor = paidByPeriod.get(w.periodKey) || 0;
    const prev = index > 0 ? (paidByPeriod.get(volumeWindows[index - 1].periodKey) || 0) : null;
    let changePct: number | null = null;
    if (prev !== null && prev > 0) {
      changePct = Math.round(((amountMinor - prev) / prev) * 100);
    } else if (prev === 0 && amountMinor > 0) {
      changePct = 100;
    } else if (prev === 0 && amountMinor === 0) {
      changePct = 0;
    }
    return {
      periodKey: w.periodKey,
      label: shortPeriodLabel(w.periodKey, cadence),
      amountMinor,
      changePct,
      isCurrent: w.periodKey === current.periodKey,
    };
  });

  // Upcoming: current + next 3; hide fully paid periods.
  const upcomingWindows = listPeriodWindows(cadence, dateKey, {
    direction: "future",
    count: 4,
    from: current,
    now,
  });
  const upcoming = upcomingWindows.flatMap((w) => {
    const paidIds = new Set(
      paidRows.results
        .filter((r) => r.period_key === w.periodKey && r.status === "paid")
        .map((r) => r.employee_id),
    );
    let amountMinor = 0;
    let employeeCount = 0;
    for (const emp of fullTime) {
      if (paidIds.has(emp.id)) continue;
      amountMinor += Number(emp.amount_minor || 0);
      employeeCount += 1;
    }
    if (employeeCount === 0) return [];
    return [{
      periodKey: w.periodKey,
      title: payrollTitleForPeriod(w.periodKey, cadence),
      payday: w.payday,
      paydayDisplay: formatPaydayDisplay(w.payday),
      employeeCount,
      amountMinor,
    }];
  });

  const recentSorted = [...paidRows.results]
    .filter((r) => r.status === "paid" || r.status === "processing")
    .sort((a, b) => {
      const at = a.paid_at || a.created_at;
      const bt = b.paid_at || b.created_at;
      return bt.localeCompare(at);
    })
    .slice(0, 5)
    .map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      name: r.name,
      role_title: r.role_title,
      amount_minor: Number(r.amount_minor || 0),
      token: r.token,
      network: r.network,
      status: r.status as "paid" | "processing",
      paid_at: r.paid_at || r.created_at,
      period_key: r.period_key,
    }));

  const totalHeadcount = employees.results.length || 1;
  const category = [
    {
      type: "employee" as const,
      label: "Employees",
      count: fullTime.length,
      pct: Math.round((fullTime.length / totalHeadcount) * 100),
    },
    {
      type: "contractor" as const,
      label: "Contractors",
      count: contractors.length,
      pct: Math.round((contractors.length / totalHeadcount) * 100),
    },
  ].filter((c) => c.count > 0);

  const networkCounts = new Map<string, number>();
  for (const emp of employees.results) {
    const network = String(emp.network || "Unknown").trim() || "Unknown";
    networkCounts.set(network, (networkCounts.get(network) || 0) + 1);
  }
  const networkTotal = employees.results.length || 1;
  const networks = [...networkCounts.entries()]
    .map(([network, count]) => ({
      network,
      count,
      pct: Math.round((count / networkTotal) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  return c.json({
    org: { id: org.id, name: org.name },
    period: {
      periodKey: selected.periodKey,
      payday: selected.payday,
      paydayDisplay: formatPaydayDisplay(selected.payday),
      cadence,
      monthLabel: monthLabelForPayday(selected.payday),
      currentPeriodKey: current.periodKey,
    },
    stats: {
      paidMinor,
      paidCount,
      awaitingMinor,
      awaitingCount,
      daysLeft,
      progress,
      recipientsCount,
    },
    volume: {
      range: volumeRange,
      cadence,
      bars: volumeBars,
    },
    upcoming,
    recentPayments: recentSorted,
    category,
    networks,
  });
});

// Org-wide payment history for a period (Payment History page).
orgRoutes.get("/payments", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const org = await c.env.DB.prepare(
    `SELECT id, name, payment_cadence, payment_date_key, payment_configured_at
     FROM organizations WHERE id = ?`,
  ).bind(user.org_id).first<{
    id: string;
    name: string;
    payment_cadence: string | null;
    payment_date_key: string | null;
    payment_configured_at: string | null;
  }>();
  if (!org) return c.json({ error: "Organization not found" }, 404);
  if (!org.payment_configured_at || !org.payment_cadence || !org.payment_date_key) {
    return c.json({ error: "Team payment preferences are not configured", code: "PAYMENT_NOT_CONFIGURED" }, 409);
  }

  const cadence = org.payment_cadence as TeamPaymentSchedule;
  const dateKey = org.payment_date_key as TeamPaymentDateKey;
  const now = new Date();
  const current = resolveCurrentPeriod(cadence, dateKey, now);
  const periodKeyParam = String(c.req.query("periodKey") || "").trim();
  let selected = current;
  if (periodKeyParam) {
    const resolved = resolvePeriodFromKey(cadence, dateKey, periodKeyParam);
    if (!resolved) return c.json({ error: "Invalid periodKey for team cadence" }, 400);
    selected = resolved;
  }

  const q = String(c.req.query("q") || "").trim().toLowerCase();

  const rows = await c.env.DB.prepare(
    `SELECT ep.id, ep.employee_id, ep.amount_minor, ep.token, ep.network, ep.status,
            ep.paid_at, ep.created_at, ep.period_key,
            e.name, e.role_title, e.employee_type
     FROM employee_payments ep
     JOIN employees e ON e.id = ep.employee_id AND e.org_id = ep.org_id
     WHERE ep.org_id = ? AND ep.period_key = ?
     ORDER BY COALESCE(ep.paid_at, ep.created_at) DESC, ep.id DESC`,
  ).bind(user.org_id, selected.periodKey).all<{
    id: string;
    employee_id: string;
    amount_minor: number;
    token: string;
    network: string;
    status: string;
    paid_at: string | null;
    created_at: string;
    period_key: string;
    name: string;
    role_title: string | null;
    employee_type: string;
  }>();

  const payments = rows.results
    .filter((r) => !q || r.name.toLowerCase().includes(q))
    .map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      name: r.name,
      role_title: r.role_title,
      employee_type: (r.employee_type || "employee") as EmployeeType,
      amount_minor: Number(r.amount_minor || 0),
      token: r.token,
      network: r.network,
      status: r.status,
      paid_at: r.paid_at || r.created_at,
      period_key: r.period_key,
    }));

  return c.json({
    org: { id: org.id, name: org.name },
    period: {
      periodKey: selected.periodKey,
      payday: selected.payday,
      paydayDisplay: formatPaydayDisplay(selected.payday),
      cadence,
      monthLabel: monthLabelForPayday(selected.payday),
    },
    payments,
  });
});

// Employee directory (linked to org; can be pre-provisioned before account acceptance)
orgRoutes.get("/employees", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const q = String(c.req.query("q") || "").trim().toLowerCase();
  const typeFilter = String(c.req.query("type") || "").trim().toLowerCase();
  const pageRaw = c.req.query("page");
  const pageSizeRaw = c.req.query("pageSize");
  const paginate = pageRaw !== undefined || pageSizeRaw !== undefined;
  const page = Math.max(1, Number.parseInt(String(pageRaw || "1"), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(pageSizeRaw || "10"), 10) || 10));

  const org = await c.env.DB.prepare(
    `SELECT payment_cadence, payment_date_key, payment_configured_at
     FROM organizations WHERE id = ?`,
  ).bind(user.org_id).first<{
    payment_cadence: string | null;
    payment_date_key: string | null;
    payment_configured_at: string | null;
  }>();

  const rows = await c.env.DB.prepare(
    `SELECT id, user_id, email, name, role_title, location, employee_type, token, network,
            amount_minor, endpoint, status, payout_verified_at, last_paid_at, created_at,
            payment_cadence, payment_date_key
     FROM employees WHERE org_id = ? ORDER BY created_at DESC`,
  ).bind(user.org_id).all<Record<string, unknown> & {
    id: string;
    email: string | null;
    name: string;
    endpoint: string | null;
    employee_type: string;
    created_at: string;
    payment_cadence: string | null;
    payment_date_key: string | null;
  }>();

  const teamCadence = (org?.payment_cadence as TeamPaymentSchedule | null) || null;
  const teamDateKey = (org?.payment_date_key as TeamPaymentDateKey | null) || null;
  const now = new Date();
  const teamConfigured = !!(org?.payment_configured_at && teamCadence && teamDateKey);

  const enriched = rows.results.map((emp) => {
    const employeeType = ((emp.employee_type || "employee") as EmployeeType);
    const schedule = resolveRecipientSchedule({
      employeeType,
      teamCadence,
      teamDateKey,
      paymentCadence: emp.payment_cadence,
      paymentDateKey: emp.payment_date_key,
    });

    let nextPayday: string | null = null;
    let displayCadence: string | null = schedule?.cadence ?? null;
    let displayDateKey: string | null = schedule?.dateKey ?? null;

    if (schedule?.scheduled && schedule.dateKey && (schedule.cadence === "monthly" || schedule.cadence === "weekly")) {
      const cadence = schedule.cadence;
      const dateKey = schedule.dateKey;
      try {
        const next = resolveNextPeriod(cadence, dateKey, now);
        nextPayday = next.payday;
      } catch {
        nextPayday = null;
      }
    } else if (employeeType === "employee" && !teamConfigured) {
      displayCadence = teamCadence;
      displayDateKey = teamDateKey;
    }

    return {
      ...emp,
      employee_type: employeeType,
      payment_cadence: displayCadence,
      payment_date_key: displayDateKey,
      nextPayday,
      nextPaydayDisplay: nextPayday ? formatPaydayDisplay(nextPayday) : null,
    };
  });

  const counts = {
    all: enriched.length,
    employees: enriched.filter((e) => e.employee_type === "employee").length,
    contractors: enriched.filter((e) => e.employee_type === "contractor").length,
  };

  let filtered = enriched;
  if (typeFilter === "employee" || typeFilter === "contractor") {
    filtered = filtered.filter((e) => e.employee_type === typeFilter);
  }
  if (q) {
    filtered = filtered.filter((e) => {
      const name = String(e.name || "").toLowerCase();
      const email = String(e.email || "").toLowerCase();
      const endpoint = String(e.endpoint || "").toLowerCase();
      return name.includes(q) || email.includes(q) || endpoint.includes(q);
    });
  }

  const total = filtered.length;
  const pageRows = paginate
    ? filtered.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize)
    : filtered;

  return c.json({
    employees: pageRows,
    total,
    page: paginate ? page : 1,
    pageSize: paginate ? pageSize : total,
    counts,
  });
});
orgRoutes.get("/employees/:id/payments", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const employeeId = c.req.param("id");
  const emp = await c.env.DB.prepare(
    "SELECT id FROM employees WHERE id = ? AND org_id = ?",
  ).bind(employeeId, user.org_id).first();
  if (!emp) return c.json({ error: "Employee not found" }, 404);

  const limit = Math.min(50, Math.max(1, Number.parseInt(String(c.req.query("limit") || "20"), 10) || 20));
  const cursor = String(c.req.query("cursor") || "").trim();

  let sql = `
    SELECT ep.id, ep.paid_at, ep.amount_minor, ep.token, ep.network, ep.period_key, ep.status, ep.created_at,
           pa.deposit_tx_hash AS tx_hash
    FROM employee_payments ep
    LEFT JOIN payment_attempts pa ON pa.employee_payment_id = ep.id AND pa.state = 'confirmed'
    WHERE ep.org_id = ? AND ep.employee_id = ? AND ep.status = 'paid'
  `;
  const binds: unknown[] = [user.org_id, employeeId];
  if (cursor) {
    sql += ` AND (ep.paid_at < ? OR (ep.paid_at = ? AND ep.id < ?))`;
    binds.push(cursor, cursor, cursor);
  }
  sql += ` ORDER BY ep.paid_at DESC, ep.id DESC LIMIT ?`;
  binds.push(limit + 1);

  const rows = await c.env.DB.prepare(sql).bind(...binds).all<{
    id: string;
    paid_at: string | null;
    amount_minor: number;
    token: string;
    network: string;
    period_key: string;
    status: string;
    created_at: string;
    tx_hash: string | null;
  }>();

  const hasMore = rows.results.length > limit;
  const page = hasMore ? rows.results.slice(0, limit) : rows.results;
  const nextCursor = hasMore && page.length
    ? (page[page.length - 1].paid_at || page[page.length - 1].created_at)
    : null;

  return c.json({
    payments: page.map((r) => ({
      id: r.id,
      paid_at: r.paid_at || r.created_at,
      amount_minor: r.amount_minor,
      token: r.token,
      network: r.network,
      period_key: r.period_key,
      txHash: r.tx_hash,
      explorerUrl: r.tx_hash && r.network
        ? explorerUrlForTx(r.network, r.tx_hash)
        : null,
    })),
    nextCursor,
  });
});

function explorerUrlForTx(network: string, txHash: string): string | null {
  const n = network.toLowerCase();
  const hash = txHash.startsWith("0x") ? txHash : `0x${txHash}`;
  if (n.includes("arbitrum")) return `https://arbiscan.io/tx/${hash}`;
  if (n.includes("base")) return `https://basescan.org/tx/${hash}`;
  if (n.includes("polygon")) return `https://polygonscan.com/tx/${hash}`;
  if (n.includes("optimism")) return `https://optimistic.etherscan.io/tx/${hash}`;
  if (n.includes("ethereum") || n === "eth" || n === "mainnet") return `https://etherscan.io/tx/${hash}`;
  return `https://basescan.org/tx/${hash}`;
}

orgRoutes.post("/employees", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const body = await c.req.json().catch(() => null);
  const name = String(body?.name || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();
  if (!name) return c.json({ error: "Name is required" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: "A valid email is required" }, 400);

  const employeeType = body?.employee_type !== undefined || body?.employeeType !== undefined
    ? normalizeEmployeeType(body?.employee_type ?? body?.employeeType)
    : "employee";
  if (!employeeType) return c.json({ error: "Type must be employee or contractor" }, 400);

  const roleTitle = normalizeRoleTitle(body?.role_title ?? body?.roleTitle);
  if (roleTitle === null) return c.json({ error: "Choose a valid role" }, 400);

  let paymentCadence: string | null = null;
  let paymentDateKey: string | null = null;
  if (employeeType === "contractor") {
    const parsed = parseContractorScheduleInput(body || {});
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    paymentCadence = parsed.cadence;
    paymentDateKey = parsed.dateKey;
  }

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
    `INSERT INTO employees (
       id, org_id, email, name, role_title, location, employee_type, token, network,
       amount_minor, endpoint, status, payment_cadence, payment_date_key, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
  ).bind(
    id,
    user.org_id,
    email,
    name,
    roleTitle,
    String(body?.location || ""),
    employeeType,
    token,
    network,
    amountMinor,
    endpoint,
    paymentCadence,
    paymentDateKey,
    nowIso(),
  ).run();
  await c.env.DB.prepare(
    "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'employee.created', ?)",
  ).bind(uuid(), user.org_id, user.id, `Added ${employeeType} ${name}`).run();
  const row = await c.env.DB.prepare("SELECT * FROM employees WHERE id = ? AND org_id = ?").bind(id, user.org_id).first();
  return c.json({ employee: row }, 201);
});

orgRoutes.patch("/employees/:id", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const existing = await c.env.DB.prepare(
    "SELECT * FROM employees WHERE id = ? AND org_id = ?",
  ).bind(id, user.org_id).first<Record<string, unknown>>();
  if (!existing) return c.json({ error: "Employee not found" }, 404);

  const fields: string[] = [];
  const values: unknown[] = [];
  if (body?.status !== undefined) {
    return c.json({ error: "Payout readiness is managed by wallet signature verification" }, 400);
  }
  if (body?.email !== undefined) {
    const email = String(body.email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: "A valid email is required" }, 400);
    const dup = await c.env.DB.prepare(
      "SELECT id FROM employees WHERE org_id = ? AND email = ? AND id != ?",
    ).bind(user.org_id, email, id).first();
    if (dup) return c.json({ error: "An employee with this email already exists" }, 409);
    fields.push("email = ?");
    values.push(email);
  }
  if (body?.name !== undefined) {
    fields.push("name = ?");
    values.push(String(body.name).trim());
  }
  if (body?.location !== undefined) {
    fields.push("location = ?");
    values.push(body.location);
  }
  if (body?.role_title !== undefined || body?.roleTitle !== undefined) {
    const roleTitle = normalizeRoleTitle(body?.role_title ?? body?.roleTitle);
    if (roleTitle === null) return c.json({ error: "Choose a valid role" }, 400);
    fields.push("role_title = ?");
    values.push(roleTitle);
  }

  let nextType = (existing.employee_type as string) || "employee";
  if (body?.employee_type !== undefined || body?.employeeType !== undefined) {
    const employeeType = normalizeEmployeeType(body?.employee_type ?? body?.employeeType);
    if (!employeeType) return c.json({ error: "Type must be employee or contractor" }, 400);
    fields.push("employee_type = ?");
    values.push(employeeType);
    nextType = employeeType;
  }

  const scheduleTouched =
    body?.payment_cadence !== undefined
    || body?.paymentCadence !== undefined
    || body?.payment_date_key !== undefined
    || body?.paymentDate !== undefined
    || body?.employee_type !== undefined
    || body?.employeeType !== undefined;

  if (scheduleTouched) {
    if (nextType === "employee") {
      fields.push("payment_cadence = ?", "payment_date_key = ?");
      values.push(null, null);
    } else {
      const parsed = parseContractorScheduleInput(body || {
        payment_cadence: existing.payment_cadence,
        payment_date_key: existing.payment_date_key,
      });
      // If only type flipped to contractor without schedule, default on_demand.
      if (!parsed.ok && (body?.employee_type !== undefined || body?.employeeType !== undefined)
        && body?.payment_cadence === undefined && body?.paymentCadence === undefined) {
        fields.push("payment_cadence = ?", "payment_date_key = ?");
        values.push("on_demand", null);
      } else if (!parsed.ok) {
        return c.json({ error: parsed.error }, 400);
      } else {
        fields.push("payment_cadence = ?", "payment_date_key = ?");
        values.push(parsed.cadence, parsed.dateKey);
      }
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
  const id = c.req.param("id");
  const emp = await c.env.DB.prepare(
    "SELECT id, user_id, name, email FROM employees WHERE id = ? AND org_id = ?",
  ).bind(id, user.org_id).first<{ id: string; user_id: string | null; name: string; email: string | null }>();
  if (!emp) return c.json({ error: "Employee not found" }, 404);

  const statements: D1PreparedStatement[] = [
    c.env.DB.prepare("DELETE FROM employees WHERE id = ? AND org_id = ?").bind(id, user.org_id),
    c.env.DB.prepare(
      "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'employee.removed', ?)",
    ).bind(uuid(), user.org_id, user.id, `Removed ${emp.name}${emp.email ? ` (${emp.email})` : ""} from team`),
  ];
  if (emp.user_id) {
    // Unlink account from this org (single-org model). Keep the user row.
    statements.unshift(
      c.env.DB.prepare(
        "UPDATE users SET org_id = NULL, role = 'employee', updated_at = ? WHERE id = ? AND org_id = ?",
      ).bind(nowIso(), emp.user_id, user.org_id),
    );
  }
  await c.env.DB.batch(statements);
  return c.json({ ok: true });
});
