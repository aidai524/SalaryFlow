/** Parse a human decimal amount. Returns canonical string or null if invalid / not > 0. */
export function parsePositiveDecimal(raw: string, maxDecimals = 6): string | null {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const pattern = new RegExp(`^(0|[1-9]\\d*)(\\.\\d{0,${maxDecimals}})?$`);
  if (!pattern.test(cleaned)) return null;
  if (Number(cleaned) <= 0) return null;
  return cleaned;
}

/**
 * Keep only a valid decimal prefix. Extra fractional digits are truncated
 * (typing and paste). Illegal characters are dropped.
 */
export function sanitizeDecimalInput(raw: string, maxDecimals = 6): string {
  const decimals = Number.isInteger(maxDecimals) && maxDecimals >= 0 ? maxDecimals : 6;
  let out = "";
  let seenDot = false;
  let frac = 0;
  for (const ch of raw.replace(/,/g, "")) {
    if (ch >= "0" && ch <= "9") {
      if (seenDot) {
        if (frac >= decimals) continue;
        frac += 1;
      }
      out += ch;
      continue;
    }
    if (ch === "." && !seenDot && decimals > 0) {
      seenDot = true;
      if (!out) out = "0";
      out += ".";
    }
  }
  return out;
}
