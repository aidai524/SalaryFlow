/** English-locale number / currency / date helpers (Intl). */

export type AmountRoundingMode =
  | "ceil"
  | "floor"
  | "expand"
  | "trunc"
  | "halfCeil"
  | "halfFloor"
  | "halfExpand"
  | "halfTrunc"
  | "halfEven";

export type AmountFormatOptions = {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  roundingMode?: AmountRoundingMode;
};

const DEFAULT_ROUNDING_MODE: AmountRoundingMode = "trunc";

/** Current TS lib.dom NumberFormatOptions does not include roundingMode. */
function intlNumberOptions(options: {
  style?: "decimal" | "currency";
  currency?: string;
  minimumFractionDigits: number;
  maximumFractionDigits: number;
  roundingMode: AmountRoundingMode;
}): Intl.NumberFormatOptions {
  return options as Intl.NumberFormatOptions;
}

function roundingModeOf(options?: AmountFormatOptions): AmountRoundingMode {
  return options?.roundingMode ?? DEFAULT_ROUNDING_MODE;
}

const numberFmt = new Intl.NumberFormat("en-US", intlNumberOptions({
  minimumFractionDigits: 0,
  maximumFractionDigits: 6,
  roundingMode: DEFAULT_ROUNDING_MODE,
}));

const currencyFmt = new Intl.NumberFormat("en-US", intlNumberOptions({
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  roundingMode: DEFAULT_ROUNDING_MODE,
}));

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** Format a decimal number with en-US grouping (e.g. 5,000.23). */
export function formatNumber(
  value: number | string,
  options?: AmountFormatOptions,
): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "0";
  if (options) {
    return new Intl.NumberFormat("en-US", intlNumberOptions({
      minimumFractionDigits: options.minimumFractionDigits ?? 0,
      maximumFractionDigits: options.maximumFractionDigits ?? 6,
      roundingMode: roundingModeOf(options),
    })).format(n);
  }
  return numberFmt.format(n);
}

/** Format USD currency (e.g. $65,880.00). */
export function formatCurrency(
  value: number | string,
  options?: AmountFormatOptions,
): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "$0.00";
  if (options) {
    return new Intl.NumberFormat("en-US", intlNumberOptions({
      style: "currency",
      currency: "USD",
      minimumFractionDigits: options.minimumFractionDigits ?? 2,
      maximumFractionDigits: options.maximumFractionDigits ?? 2,
      roundingMode: roundingModeOf(options),
    })).format(n);
  }
  return currencyFmt.format(n);
}

/**
 * Format token minor units (1e6 scale) as a decimal string with grouping.
 * e.g. 5000000000 → "5,000"
 */
export function formatTokenMinor(
  amountMinor: number,
  options?: AmountFormatOptions,
): string {
  const decimal = Number(amountMinor) / 1_000_000;
  return formatNumber(decimal, {
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 6,
    roundingMode: roundingModeOf(options),
  });
}

/** Format USD from token minor units (1e6). */
export function formatCurrencyFromMinor(
  amountMinor: number,
  options?: AmountFormatOptions,
): string {
  return formatCurrency(Number(amountMinor) / 1_000_000, options);
}

/** Format a Date / ISO / YYYY-MM-DD as "Sep 1, 2026". */
export function formatDate(value: Date | string): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    // Treat bare dates as UTC calendar days to avoid timezone shift.
    const [y, m, d] = value.split("-").map(Number);
    return dateFmt.format(new Date(Date.UTC(y, m - 1, d)));
  }
  const d = typeof value === "string" ? new Date(value) : value;
  if (!Number.isFinite(d.getTime())) return "";
  return dateFmt.format(d);
}

const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Format ISO datetime as "Aug 1, 2026 11:56". */
export function formatDateTime(value: string): string {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value;
  return dateTimeFmt.format(d);
}

/** Truncate an address: 0x541…8dc1 */
export function formatAddress(address: string, left = 5, right = 5): string {
  const value = String(address || "");
  if (value.length <= left + right + 1) return value;
  return `${value.slice(0, left)}...${value.slice(-right)}`;
}
