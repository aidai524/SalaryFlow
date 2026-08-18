// Parse 1Click / provider quote errors into short, user-facing text.
// Reference: stableflow-x formatRheaQuoteErrorMessage.

import Big from "big.js";
import { ApiError } from "@/lib/api";

const USER_REJECTED_PATTERNS = [
  "user rejected",
  "user denied",
  "rejected the request",
  "request rejected",
  "action_rejected",
];

/** Pull the `message` field out of an embedded JSON blob (e.g. `1Click /v0/quote failed (400): {...}`). */
function extractEmbeddedMessage(text: string): string | null {
  const start = text.indexOf("{");
  if (start >= 0) {
    try {
      const parsed = JSON.parse(text.slice(start)) as { message?: unknown };
      if (typeof parsed.message === "string" && parsed.message) return parsed.message;
      if (Array.isArray(parsed.message) && parsed.message.length > 0) {
        return parsed.message.map(String).join("; ");
      }
    } catch {
      // Truncated / malformed JSON — fall through to regex.
    }
  }
  const match = text.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (match) {
    try {
      return JSON.parse(`"${match[1]}"`) as string;
    } catch {
      return match[1];
    }
  }
  return null;
}

/**
 * Format a quote / settle error for display. `decimals` should be the
 * destination token decimals (used to humanize raw EXACT_OUTPUT minimum amounts).
 */
export function formatQuoteErrorMessage(error: unknown, decimals = 6): string {
  const raw = error instanceof ApiError && error.detail
    ? error.detail
    : error instanceof Error
      ? error.message
      : String(error ?? "");
  const text = raw || "Quote failed";
  const message = extractEmbeddedMessage(text) || text;

  const lower = message.toLowerCase();
  if (USER_REJECTED_PATTERNS.some((pattern) => lower.includes(pattern))) {
    return "User rejected transaction";
  }

  const amountTooLow = message.match(/Amount is too low for bridge,\s*try at least\s+(\d+(?:\.\d+)?)/i);
  if (amountTooLow) {
    try {
      const humanAmount = Big(amountTooLow[1]).div(Big(10).pow(decimals)).toFixed();
      return `Amount is too low for bridge, try at least ${humanAmount}`;
    } catch {
      return "Amount is too low for bridge";
    }
  }

  if (/No liquidity available/i.test(message)) {
    return "No liquidity available";
  }

  if (message.length > 80 || /Cross-chain quote failed/i.test(message)) {
    return "Quote failed";
  }

  return message;
}
