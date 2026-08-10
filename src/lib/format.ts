/** English-locale number / currency / date helpers (Intl). */

const numberFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 6,
});

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** Format a decimal number with en-US grouping (e.g. 5,000.23). */
export function formatNumber(
  value: number | string,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number },
): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "0";
  if (options) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: options.minimumFractionDigits ?? 0,
      maximumFractionDigits: options.maximumFractionDigits ?? 6,
    }).format(n);
  }
  return numberFmt.format(n);
}

/** Format USD currency (e.g. $65,880.00). */
export function formatCurrency(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "$0.00";
  return currencyFmt.format(n);
}

/**
 * Format token minor units (1e6 scale) as a decimal string with grouping.
 * e.g. 5000000000 → "5,000"
 */
export function formatTokenMinor(
  amountMinor: number,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number },
): string {
  const decimal = Number(amountMinor) / 1_000_000;
  return formatNumber(decimal, {
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 6,
  });
}

/** Format USD from token minor units (1e6). */
export function formatCurrencyFromMinor(amountMinor: number): string {
  return formatCurrency(Number(amountMinor) / 1_000_000);
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
