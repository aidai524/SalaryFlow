export const TOKEN_MINOR_SCALE = 1_000_000;
const TOKEN_MINOR_SCALE_BIGINT = BigInt(TOKEN_MINOR_SCALE);
const MAX_SAFE_MINOR = BigInt(Number.MAX_SAFE_INTEGER);
const TOKEN_AMOUNT_PATTERN = /^(0|[1-9]\d*)(?:\.(\d{1,6}))?$/;

export function parseTokenAmount(value: unknown, options: { allowZero?: boolean } = {}): number | null {
  const raw = String(value ?? "").trim();
  const match = TOKEN_AMOUNT_PATTERN.exec(raw);
  if (!match) return null;

  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] ?? "").padEnd(6, "0") || "0");
  const minor = whole * TOKEN_MINOR_SCALE_BIGINT + fraction;
  if ((!options.allowZero && minor === 0n) || minor > MAX_SAFE_MINOR) return null;
  return Number(minor);
}
