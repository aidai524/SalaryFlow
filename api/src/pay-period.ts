// UTC pay-period helpers for team payment preferences (organizations.*).
// Used by Pay overview stats and Quick Pay employee_payments.period_key.

import type { TeamPaymentDateKey, TeamPaymentSchedule } from "./org-payment";

export interface PeriodWindow {
  periodKey: string;
  /** ISO date YYYY-MM-DD (UTC) of the payday for this period. */
  payday: string;
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
    return { periodKey, payday, cadence };
  }

  const weekday = weekdayFromKey(dateKey);
  if (weekday === null) {
    throw new Error(`Invalid weekly payment_date_key: ${dateKey}`);
  }
  const payday = nextWeekdayOnOrAfter(today, weekday);
  const periodKey = isoWeekKey(utcMidnight(payday));
  return { periodKey, payday, cadence };
}

/** Alias for team or contractor monthly/weekly cadence. */
export const resolvePeriodForCadence = resolveCurrentPeriod;

/**
 * Next pay period after the current window (for Recipients detail "Next Payment").
 */
export function resolveNextPeriod(
  cadence: TeamPaymentSchedule,
  dateKey: TeamPaymentDateKey,
  now: Date = new Date(),
): PeriodWindow {
  const current = resolveCurrentPeriod(cadence, dateKey, now);
  const dayAfter = utcMidnight(addUtcDays(current.payday, 1));
  return resolveCurrentPeriod(cadence, dateKey, dayAfter);
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
