// UTC pay-period helpers for team payment preferences (organizations.*).
// Used by Pay overview stats and Quick Pay employee_payments.period_key.

import type { TeamPaymentDateKey, TeamPaymentSchedule } from "./org-payment";

export type EmployeePayStatus = "to_be_paid" | "paid" | "none";

export interface PeriodWindow {
  periodKey: string;
  /** ISO date YYYY-MM-DD (UTC) of the payday for this period. */
  payday: string;
  /** ISO datetime: reminder window opens at this UTC midnight. */
  reminderStartsAt: string;
  cadence: TeamPaymentSchedule;
}

const WEEKDAY_KEYS: TeamPaymentDateKey[] = [
  "every_sunday",
  "every_monday",
  "every_tuesday",
  "every_wednesday",
  "every_thursday",
  "every_friday",
  "every_saturday",
];

function utcYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function utcMidnight(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

function addUtcDays(ymd: string, days: number): string {
  const d = utcMidnight(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return utcYmd(d);
}

function lastDayOfMonthUtc(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function isoWeekKey(d: Date): string {
  // ISO week date (UTC): week belonging to the Thursday of the week.
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function monthlyPaydayInMonth(year: number, monthIndex: number, dateKey: TeamPaymentDateKey): string {
  if (dateKey === "every_1st") return utcYmd(new Date(Date.UTC(year, monthIndex, 1)));
  if (dateKey === "every_15th") return utcYmd(new Date(Date.UTC(year, monthIndex, 15)));
  const last = lastDayOfMonthUtc(year, monthIndex);
  return utcYmd(new Date(Date.UTC(year, monthIndex, last)));
}

function weekdayFromKey(dateKey: TeamPaymentDateKey): number | null {
  const idx = WEEKDAY_KEYS.indexOf(dateKey);
  return idx >= 0 ? idx : null;
}

/** Next occurrence of weekday on or after `fromYmd` (UTC). */
function nextWeekdayOnOrAfter(fromYmd: string, weekday: number): string {
  const d = utcMidnight(fromYmd);
  const current = d.getUTCDay();
  const delta = (weekday - current + 7) % 7;
  d.setUTCDate(d.getUTCDate() + delta);
  return utcYmd(d);
}

/**
 * Resolve the current pay period for the team schedule.
 * - Monthly: period is calendar month of the upcoming/current payday.
 * - Weekly: period is the ISO week of the upcoming/current payday weekday.
 */
export function resolveCurrentPeriod(
  cadence: TeamPaymentSchedule,
  dateKey: TeamPaymentDateKey,
  reminderLeadDays: number,
  now: Date = new Date(),
): PeriodWindow {
  const today = utcYmd(now);

  if (cadence === "monthly") {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    let payday = monthlyPaydayInMonth(year, month, dateKey);
    // If today is after this month's payday, current period is next month.
    if (today > payday) {
      const next = month === 11 ? { y: year + 1, m: 0 } : { y: year, m: month + 1 };
      payday = monthlyPaydayInMonth(next.y, next.m, dateKey);
    }
    const periodKey = payday.slice(0, 7); // YYYY-MM
    const reminderStartsAt = `${addUtcDays(payday, -Math.max(0, reminderLeadDays))}T00:00:00.000Z`;
    return { periodKey, payday, reminderStartsAt, cadence };
  }

  const weekday = weekdayFromKey(dateKey);
  if (weekday === null) {
    throw new Error(`Invalid weekly payment_date_key: ${dateKey}`);
  }
  let payday = nextWeekdayOnOrAfter(today, weekday);
  // If today is after payday earlier today isn't possible (ymd compare); if today > last payday
  // nextWeekdayOnOrAfter already returns today when it matches.
  const periodKey = isoWeekKey(utcMidnight(payday));
  const reminderStartsAt = `${addUtcDays(payday, -Math.max(0, reminderLeadDays))}T00:00:00.000Z`;
  return { periodKey, payday, reminderStartsAt, cadence };
}

/** All period keys from employee join date through (but not including) current, plus current. */
export function enumeratePeriodsSince(
  cadence: TeamPaymentSchedule,
  dateKey: TeamPaymentDateKey,
  reminderLeadDays: number,
  sinceIso: string,
  now: Date = new Date(),
): PeriodWindow[] {
  const since = new Date(sinceIso);
  if (!Number.isFinite(since.getTime())) return [resolveCurrentPeriod(cadence, dateKey, reminderLeadDays, now)];

  const windows: PeriodWindow[] = [];
  const seen = new Set<string>();
  // Walk forward from join month/week up to current period.
  const cursor = new Date(since);
  // Cap iterations to avoid runaway loops.
  for (let i = 0; i < 260; i++) {
    const window = resolveCurrentPeriod(cadence, dateKey, reminderLeadDays, cursor);
    if (!seen.has(window.periodKey)) {
      // Only include periods whose payday is on/after the join day.
      if (window.payday >= utcYmd(since)) {
        windows.push(window);
        seen.add(window.periodKey);
      }
    }
    const current = resolveCurrentPeriod(cadence, dateKey, reminderLeadDays, now);
    if (window.periodKey === current.periodKey && cursor >= now) break;

    if (cadence === "monthly") {
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      cursor.setUTCDate(1);
    } else {
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }
    if (cursor.getTime() > now.getTime() + 14 * 86400000) break;
  }

  const current = resolveCurrentPeriod(cadence, dateKey, reminderLeadDays, now);
  if (!seen.has(current.periodKey)) windows.push(current);
  return windows;
}

export function isInReminderWindow(window: PeriodWindow, now: Date = new Date()): boolean {
  return now.getTime() >= Date.parse(window.reminderStartsAt);
}

/**
 * Compute employee pay status badge for the current period.
 * - to_be_paid: in reminder window and unpaid for current, OR any past unpaid period since join
 * - paid: no arrears and current period is paid
 * - none: before reminder window and current unpaid, with no past arrears
 */
export function computeEmployeePayStatus(opts: {
  current: PeriodWindow;
  now?: Date;
  /** period_key → paid boolean for periods since join */
  paidByPeriod: Map<string, boolean>;
  periodKeysSinceJoin: string[];
}): EmployeePayStatus {
  const now = opts.now ?? new Date();
  const pastKeys = opts.periodKeysSinceJoin.filter((k) => k !== opts.current.periodKey);
  const hasArrears = pastKeys.some((k) => !opts.paidByPeriod.get(k));
  if (hasArrears) return "to_be_paid";

  const currentPaid = !!opts.paidByPeriod.get(opts.current.periodKey);
  if (currentPaid) return "paid";
  if (isInReminderWindow(opts.current, now)) return "to_be_paid";
  return "none";
}

export function formatPaydayDisplay(paydayYmd: string): string {
  const d = utcMidnight(paydayYmd);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function monthLabelForPayday(paydayYmd: string): string {
  const d = utcMidnight(paydayYmd);
  return new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(d);
}
