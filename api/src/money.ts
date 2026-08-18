export const TOKEN_MINOR_SCALE = 1_000_000;
const TOKEN_MINOR_SCALE_BIGINT = BigInt(TOKEN_MINOR_SCALE);
const MAX_SAFE_MINOR = BigInt(Number.MAX_SAFE_INTEGER);
const TOKEN_AMOUNT_PATTERN = /^(0|[1-9]\d*)(?:\.(\d{1,6}))?$/;
const MAX_TOKEN_DECIMALS = 36;

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

/** Human amount → destination integer units for 1Click, plus 1e6 `amount_minor` (extra digits rounded). */
export function parseHumanTokenAmount(
  value: unknown,
  decimals: number,
  options: { allowZero?: boolean } = {},
): { raw: string; minor6: number } | null {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > MAX_TOKEN_DECIMALS) return null;
  const text = String(value ?? "").trim();
  if (!text) return null;
  const pattern = decimals === 0
    ? /^(0|[1-9]\d*)$/
    : new RegExp(`^(0|[1-9]\\d*)(?:\\.(\\d{1,${decimals}}))?$`);
  const match = pattern.exec(text);
  if (!match) return null;

  const whole = BigInt(match[1]);
  const fraction = decimals === 0 ? 0n : BigInt((match[2] ?? "").padEnd(decimals, "0") || "0");
  const destUnits = whole * (10n ** BigInt(decimals)) + fraction;
  if (!options.allowZero && destUnits === 0n) return null;

  let minor6: bigint;
  if (decimals === 6) {
    minor6 = destUnits;
  } else if (decimals > 6) {
    const divisor = 10n ** BigInt(decimals - 6);
    minor6 = (destUnits + divisor / 2n) / divisor;
  } else {
    minor6 = destUnits * (10n ** BigInt(6 - decimals));
  }
  if ((!options.allowZero && minor6 === 0n) || minor6 > MAX_SAFE_MINOR) return null;
  return { raw: destUnits.toString(), minor6: Number(minor6) };
}
