// UTC pay-period helpers for team payment preferences (organizations.*).
// period_key = natural calendar month / ISO week of the payment date (not payday roll-forward).
// payment_date_key only drives scheduled payday display / upcoming reminders.

import type { TeamPaymentDateKey, TeamPaymentSchedule } from "./org-payment";

export interface PeriodWindow {
  periodKey: string;
  /** ISO date YYYY-MM-DD (UTC) of the scheduled payday within this period. */
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

/** Monday (UTC YMD) of the ISO week that contains `d`. */
function isoWeekMondayYmd(d: Date): string {
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() - (day - 1));
  return utcYmd(tmp);
}

function addCalendarMonths(year: number, monthIndex: number, delta: number): { y: number; m: number } {
  const abs = year * 12 + monthIndex + delta;
  const y = Math.floor(abs / 12);
  const m = ((abs % 12) + 12) % 12;
  return { y, m };
}

function weeklyPaydayInWeek(mondayYmd: string, dateKey: TeamPaymentDateKey): string {
  const weekday = weekdayFromKey(dateKey);
  if (weekday === null) throw new Error(`Invalid weekly payment_date_key: ${dateKey}`);
  const payday = nextWeekdayOnOrAfter(mondayYmd, weekday);
  const weekEnd = addUtcDays(mondayYmd, 6);
  if (payday <= weekEnd) return payday;
  // Payday weekday before Monday in calendar sense within week — use occurrence in week.
  const d = utcMidnight(weekEnd);
  const current = d.getUTCDay();
  const delta = (current - weekday + 7) % 7;
  d.setUTCDate(d.getUTCDate() - delta);
  return utcYmd(d);
}

/**
 * Resolve the current pay period for the team schedule.
 * - Monthly: period is the natural calendar month of `now` (YYYY-MM).
 * - Weekly: period is the ISO week of `now` (YYYY-Www).
 * Scheduled payday is the date_key within that period (may already be past).
 */
export function resolveCurrentPeriod(
  cadence: TeamPaymentSchedule,
  dateKey: TeamPaymentDateKey,
  now: Date = new Date(),
): PeriodWindow {
  if (cadence === "monthly") {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const periodKey = `${year}-${String(month + 1).padStart(2, "0")}`;
    const payday = monthlyPaydayInMonth(year, month, dateKey);
    return { periodKey, payday, cadence };
  }

  const weekday = weekdayFromKey(dateKey);
  if (weekday === null) {
    throw new Error(`Invalid weekly payment_date_key: ${dateKey}`);
  }
  const periodKey = isoWeekKey(now);
  const mondayYmd = isoWeekMondayYmd(now);
  const payday = weeklyPaydayInWeek(mondayYmd, dateKey);
  return { periodKey, payday, cadence };
}

/** Alias for team or contractor monthly/weekly cadence. */
export const resolvePeriodForCadence = resolveCurrentPeriod;

/**
 * Next calendar pay period after the window that contains `now`.
 */
export function resolveNextPeriod(
  cadence: TeamPaymentSchedule,
  dateKey: TeamPaymentDateKey,
  now: Date = new Date(),
): PeriodWindow {
  const current = resolveCurrentPeriod(cadence, dateKey, now);
  return shiftPeriod(cadence, dateKey, current, 1);
}

/**
 * Next scheduled payday on or after today (reminder / Next Payment Day).
 * Independent of period_key bucketing.
 */
export function resolveUpcomingPayday(
  cadence: TeamPaymentSchedule,
  dateKey: TeamPaymentDateKey,
  now: Date = new Date(),
): string {
  const today = utcYmd(now);
  if (cadence === "monthly") {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const thisMonth = monthlyPaydayInMonth(year, month, dateKey);
    if (thisMonth >= today) return thisMonth;
    const next = addCalendarMonths(year, month, 1);
    return monthlyPaydayInMonth(next.y, next.m, dateKey);
  }
  const weekday = weekdayFromKey(dateKey);
  if (weekday === null) {
    throw new Error(`Invalid weekly payment_date_key: ${dateKey}`);
  }
  return nextWeekdayOnOrAfter(today, weekday);
}

function shiftPeriod(
  cadence: TeamPaymentSchedule,
  dateKey: TeamPaymentDateKey,
  window: PeriodWindow,
  delta: number,
): PeriodWindow {
  if (cadence === "monthly") {
    const match = /^(\d{4})-(\d{2})$/.exec(window.periodKey);
    if (!match) throw new Error(`Invalid monthly periodKey: ${window.periodKey}`);
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const next = addCalendarMonths(year, monthIndex, delta);
    const periodKey = `${next.y}-${String(next.m + 1).padStart(2, "0")}`;
    const payday = monthlyPaydayInMonth(next.y, next.m, dateKey);
    return { periodKey, payday, cadence };
  }

  const mondayYmd = isoWeekMondayYmd(utcMidnight(window.payday));
  const shiftedMonday = addUtcDays(mondayYmd, delta * 7);
  const periodKey = isoWeekKey(utcMidnight(shiftedMonday));
  const payday = weeklyPaydayInWeek(shiftedMonday, dateKey);
  return { periodKey, payday, cadence };
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
  const mondayYmd = utcYmd(monday);
  try {
    const payday = weeklyPaydayInWeek(mondayYmd, dateKey);
    return { periodKey, payday, cadence };
  } catch {
    return null;
  }
}

export type PeriodListDirection = "past" | "future";

/**
 * List consecutive period windows.
 * - past: oldest → newest, ending at `from` (inclusive), length = count
 * - future: from `from` inclusive → newer, length = count
 * Steps by natural calendar period keys (not payday roll-forward).
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
      cursor = shiftPeriod(cadence, dateKey, cursor, 1);
      out.push(cursor);
    }
    return out;
  }

  const newestFirst: PeriodWindow[] = [anchor];
  let cursor = anchor;
  while (newestFirst.length < count) {
    const prev = shiftPeriod(cadence, dateKey, cursor, -1);
    if (prev.periodKey === cursor.periodKey) break;
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
