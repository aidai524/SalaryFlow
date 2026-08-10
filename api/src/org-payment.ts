// Team payment preference helpers (organizations.*).
// Phase 1: one org per admin. Separate from payroll_runs / createRun.

import type { Env } from "./types";

export type TeamPaymentSchedule = "monthly" | "weekly";

export type TeamPaymentDateKey =
  | "every_1st"
  | "every_15th"
  | "every_end_of_month"
  | "every_monday"
  | "every_tuesday"
  | "every_wednesday"
  | "every_thursday"
  | "every_friday"
  | "every_saturday"
  | "every_sunday";

export interface ReminderLeadDefaults {
  monthly: number;
  weekly: number;
}

const DEFAULT_REMINDER_LEAD_DAYS_MONTHLY = 7;
const DEFAULT_REMINDER_LEAD_DAYS_WEEKLY = 3;

const MONTHLY_DATES = new Set<TeamPaymentDateKey>([
  "every_1st",
  "every_15th",
  "every_end_of_month",
]);

const WEEKLY_DATES = new Set<TeamPaymentDateKey>([
  "every_monday",
  "every_tuesday",
  "every_wednesday",
  "every_thursday",
  "every_friday",
  "every_saturday",
  "every_sunday",
]);

const SCHEDULES = new Set<TeamPaymentSchedule>(["monthly", "weekly"]);

function parseLeadDays(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const parsed = Number.parseInt(String(value).trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

export function getReminderLeadDefaults(env: Pick<Env, "REMINDER_LEAD_DAYS_MONTHLY" | "REMINDER_LEAD_DAYS_WEEKLY">): ReminderLeadDefaults {
  return {
    monthly: parseLeadDays(env.REMINDER_LEAD_DAYS_MONTHLY, DEFAULT_REMINDER_LEAD_DAYS_MONTHLY),
    weekly: parseLeadDays(env.REMINDER_LEAD_DAYS_WEEKLY, DEFAULT_REMINDER_LEAD_DAYS_WEEKLY),
  };
}

export function normalizeTeamPaymentSchedule(value: unknown): TeamPaymentSchedule | null {
  const schedule = String(value || "").trim().toLowerCase() as TeamPaymentSchedule;
  return SCHEDULES.has(schedule) ? schedule : null;
}

export function normalizeTeamPaymentDateKey(value: unknown): TeamPaymentDateKey | null {
  const key = String(value || "").trim().toLowerCase() as TeamPaymentDateKey;
  if (MONTHLY_DATES.has(key) || WEEKLY_DATES.has(key)) return key;
  return null;
}

export function isPaymentDateValidForSchedule(
  schedule: TeamPaymentSchedule,
  paymentDate: TeamPaymentDateKey,
): boolean {
  if (schedule === "monthly") return MONTHLY_DATES.has(paymentDate);
  return WEEKLY_DATES.has(paymentDate);
}

/** Reminder lead days from env (monthly/weekly defaults). */
export function reminderLeadDaysForSchedule(
  schedule: TeamPaymentSchedule,
  env: Pick<Env, "REMINDER_LEAD_DAYS_MONTHLY" | "REMINDER_LEAD_DAYS_WEEKLY">,
): number {
  const defaults = getReminderLeadDefaults(env);
  return schedule === "monthly" ? defaults.monthly : defaults.weekly;
}
