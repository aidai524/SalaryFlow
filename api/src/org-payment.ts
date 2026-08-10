// Team payment preference helpers (organizations.*).
// Phase 1: one org per admin. Separate from payroll_runs / createRun.

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
