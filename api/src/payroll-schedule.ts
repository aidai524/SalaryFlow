import type { Env } from "./types";
import { nowIso, uuid } from "./types";

export type PayrollCadence = "manual" | "weekly" | "biweekly" | "monthly";
export type RecurringPayrollCadence = Exclude<PayrollCadence, "manual">;

const CADENCES = new Set<PayrollCadence>(["manual", "weekly", "biweekly", "monthly"]);
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function normalizePayrollCadence(value: unknown): PayrollCadence | null {
  const cadence = String(value || "manual").toLowerCase() as PayrollCadence;
  return CADENCES.has(cadence) ? cadence : null;
}

export function isDateOnly(value: string): boolean {
  if (!DATE_ONLY.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function dateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function formatDate(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

export function addCalendarDays(value: string, days: number): string {
  const { year, month, day } = dateParts(value);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function addPayrollCadence(
  value: string,
  cadence: RecurringPayrollCadence,
  anchorDay?: number | null,
): string {
  if (cadence === "weekly") return addCalendarDays(value, 7);
  if (cadence === "biweekly") return addCalendarDays(value, 14);

  const { year, month, day } = dateParts(value);
  const nextMonthIndex = month;
  const nextYear = year + Math.floor(nextMonthIndex / 12);
  const nextMonth = (nextMonthIndex % 12) + 1;
  const lastDay = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  return formatDate(nextYear, nextMonth, Math.min(anchorDay || day, lastDay));
}

interface ScheduleRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  name: string;
  cadence: RecurringPayrollCadence;
  anchor_day: number | null;
  next_pay_date: string;
  draft_lead_days: number;
  created_by: string;
}

interface RunItemRow extends Record<string, unknown> {
  employee_id: string | null;
  employee_name: string;
  amount_minor: number;
  token: string;
  network: string;
}

export async function materializePayrollSchedules(
  env: Env,
  today = nowIso().slice(0, 10),
  orgId?: string | null,
): Promise<{ createdRuns: number }> {
  if (!isDateOnly(today)) throw new Error("A valid date is required to materialize payroll schedules");
  const query = orgId
    ? "SELECT * FROM payroll_schedules WHERE active = 1 AND archived_at IS NULL AND org_id = ? ORDER BY next_pay_date"
    : "SELECT * FROM payroll_schedules WHERE active = 1 AND archived_at IS NULL ORDER BY next_pay_date";
  const schedules = orgId
    ? await env.DB.prepare(query).bind(orgId).all<ScheduleRow>()
    : await env.DB.prepare(query).all<ScheduleRow>();
  let createdRuns = 0;

  for (const schedule of schedules.results) {
    const cutoff = addCalendarDays(today, Number(schedule.draft_lead_days || 5));
    let nextPayDate = String(schedule.next_pay_date);
    let attempts = 0;
    while (nextPayDate <= cutoff && attempts < 24) {
      attempts += 1;
      const existing = await env.DB.prepare(
        "SELECT id FROM payroll_runs WHERE schedule_id = ? AND pay_date = ?",
      ).bind(schedule.id, nextPayDate).first<{ id: string }>();

      if (!existing) {
        const source = await env.DB.prepare(
          "SELECT id FROM payroll_runs WHERE schedule_id = ? AND archived_at IS NULL ORDER BY pay_date DESC, created_at DESC LIMIT 1",
        ).bind(schedule.id).first<{ id: string }>();
        const sourceItems = source
          ? await env.DB.prepare(
            "SELECT employee_id, employee_name, amount_minor, token, network FROM payrun_items WHERE run_id = ? AND removed_at IS NULL ORDER BY created_at",
          ).bind(source.id).all<RunItemRow>()
          : { results: [] as RunItemRow[] };
        const runId = uuid();
        const timestamp = nowIso();
        const statements: D1PreparedStatement[] = [
          env.DB.prepare(
            "INSERT OR IGNORE INTO payroll_runs (id, org_id, label, pay_date, status, created_by, created_at, schedule_id, source) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, 'schedule')",
          ).bind(runId, schedule.org_id, `${schedule.name} · ${nextPayDate}`, nextPayDate, schedule.created_by, timestamp, schedule.id),
        ];
        for (const item of sourceItems.results) {
          statements.push(env.DB.prepare(
            "INSERT INTO payrun_items (id, run_id, employee_id, employee_name, amount_minor, token, network, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)",
          ).bind(uuid(), runId, item.employee_id, item.employee_name, item.amount_minor, item.token, item.network, timestamp));
        }
        statements.push(env.DB.prepare(
          "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'payroll.schedule_generated', ?)",
        ).bind(uuid(), schedule.org_id, schedule.created_by, `Generated draft ${schedule.name} for ${nextPayDate}`));
        await env.DB.batch(statements);
        createdRuns += 1;
      }

      const followingDate = addPayrollCadence(nextPayDate, schedule.cadence, schedule.anchor_day);
      await env.DB.prepare(
        "UPDATE payroll_schedules SET last_generated_date = ?, next_pay_date = ?, updated_at = ? WHERE id = ?",
      ).bind(nextPayDate, followingDate, nowIso(), schedule.id).run();
      nextPayDate = followingDate;
    }
  }

  return { createdRuns };
}
