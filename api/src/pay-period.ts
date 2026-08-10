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

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

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

/**
 * Resolve payday for an explicit period key (YYYY-MM or YYYY-Www).
 * Returns null when the key does not match the cadence format.
 */
export function resolvePeriodFromKey(
  cadence: TeamPaymentSchedule,
  dateKey: TeamPaymentDateKey,
  periodKey: string,
): PeriodWindow | null {
  if (cadence === "monthly") {
    const match = /^(\d{4})-(\d{2})$/.exec(periodKey);
    if (!match) return null;
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    if (monthIndex < 0 || monthIndex > 11) return null;
    const payday = monthlyPaydayInMonth(year, monthIndex, dateKey);
    return { periodKey, payday, cadence };
  }

  const match = /^(\d{4})-W(\d{2})$/.exec(periodKey);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;
  // ISO week: Thursday of week 1 is in `year`; Monday = Thursday - 3 days.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  const weekday = weekdayFromKey(dateKey);
  if (weekday === null) return null;
  const mondayYmd = utcYmd(monday);
  const payday = nextWeekdayOnOrAfter(mondayYmd, weekday);
  // Ensure payday stays inside this ISO week (Sun = Monday + 6).
  const weekEnd = addUtcDays(mondayYmd, 6);
  if (payday > weekEnd) {
    // Payday weekday before Monday in calendar sense within week — use prior occurrence in week.
    const d = utcMidnight(weekEnd);
    const current = d.getUTCDay();
    const delta = (current - weekday + 7) % 7;
    d.setUTCDate(d.getUTCDate() - delta);
    return { periodKey, payday: utcYmd(d), cadence };
  }
  return { periodKey, payday, cadence };
}

export type PeriodListDirection = "past" | "future";

/**
 * List consecutive period windows.
 * - past: oldest → newest, ending at `from` (inclusive), length = count
 * - future: from `from` inclusive → newer, length = count
 */
export function listPeriodWindows(
  cadence: TeamPaymentSchedule,
  dateKey: TeamPaymentDateKey,
  options: {
    direction: PeriodListDirection;
    count: number;
    from?: PeriodWindow;
    now?: Date;
  },
): PeriodWindow[] {
  const count = Math.max(0, Math.floor(options.count));
  if (count === 0) return [];
  const anchor = options.from ?? resolveCurrentPeriod(cadence, dateKey, options.now ?? new Date());

  if (options.direction === "future") {
    const out: PeriodWindow[] = [anchor];
    let cursor = anchor;
    while (out.length < count) {
      cursor = resolveNextPeriod(cadence, dateKey, utcMidnight(addUtcDays(cursor.payday, 1)));
      out.push(cursor);
    }
    return out;
  }

  // Walk backward from anchor.
  const newestFirst: PeriodWindow[] = [anchor];
  let cursor = anchor;
  while (newestFirst.length < count) {
    // Step to day before current payday, then resolve that "current" period.
    const dayBefore = utcMidnight(addUtcDays(cursor.payday, -1));
    const prev = resolveCurrentPeriod(cadence, dateKey, dayBefore);
    if (prev.periodKey === cursor.periodKey) {
      // Safety: avoid infinite loop on bad keys.
      break;
    }
    newestFirst.push(prev);
    cursor = prev;
  }
  return newestFirst.reverse();
}

/** Short axis label: "Aug" or "W32". */
export function shortPeriodLabel(periodKey: string, cadence: TeamPaymentSchedule): string {
  if (cadence === "weekly") {
    const match = /^(\d{4})-W(\d{2})$/.exec(periodKey);
    if (!match) return periodKey;
    return `W${Number(match[2])}`;
  }
  const match = /^(\d{4})-(\d{2})$/.exec(periodKey);
  if (!match) return periodKey;
  const monthIndex = Number(match[2]) - 1;
  return MONTH_SHORT[monthIndex] ?? periodKey;
}

/** Display title like "August payroll" / "Week 32 payroll". */
export function payrollTitleForPeriod(periodKey: string, cadence: TeamPaymentSchedule): string {
  if (cadence === "weekly") {
    const match = /^(\d{4})-W(\d{2})$/.exec(periodKey);
    if (!match) return `${periodKey} payroll`;
    return `Week ${Number(match[2])} payroll`;
  }
  const match = /^(\d{4})-(\d{2})$/.exec(periodKey);
  if (!match) return `${periodKey} payroll`;
  const monthIndex = Number(match[2]) - 1;
  const name = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(Number(match[1]), monthIndex, 1)),
  );
  return `${name} payroll`;
}

/** Whole UTC calendar days from today to payday (can be negative if overdue). */
export function daysUntilPayday(paydayYmd: string, now: Date = new Date()): number {
  const today = utcMidnight(utcYmd(now));
  const payday = utcMidnight(paydayYmd);
  return Math.round((payday.getTime() - today.getTime()) / 86_400_000);
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
