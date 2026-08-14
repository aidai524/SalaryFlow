/** Parse a human decimal amount. Returns canonical string or null if invalid / not > 0. */
export function parsePositiveDecimal(raw: string, maxDecimals = 6): string | null {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const pattern = new RegExp(`^(0|[1-9]\\d*)(\\.\\d{0,${maxDecimals}})?$`);
  if (!pattern.test(cleaned)) return null;
  if (Number(cleaned) <= 0) return null;
  return cleaned;
}
