import { isAddressValid, sameAddress } from "@/lib/address-validation";

export function isDryQuoteStale(input: {
  amountForQuote: string | null;
  debouncedAmountForQuote: string | null;
  isPlaceholderData: boolean;
  isPending: boolean;
  isFetching: boolean;
}): boolean {
  if (!input.amountForQuote) return false;
  const awaitingFirstFetch = input.isPending && input.isFetching;
  return (
    input.amountForQuote !== input.debouncedAmountForQuote
    || input.isPlaceholderData
    || awaitingFirstFetch
  );
}

export function sameEthereumAddress(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return sameAddress(a, b, "evm");
}

export { sameAddress };

export type LiveQuoteSettleInput = {
  context?: unknown;
  quote: {
    depositAddress?: string | null;
    amountIn?: string | null;
    deadline?: string | null;
  };
};

export type LiveQuoteSettleResult =
  | { ok: true; context: string; depositAddress: string; amountIn: bigint }
  | { ok: false; reason: "missing_context" | "invalid_deposit" | "invalid_amount" | "expired" };

const POSITIVE_INT_STRING = /^[1-9]\d*$/;

export function validateLiveQuoteForSettle(
  live: LiveQuoteSettleInput,
  nowMs = Date.now(),
  chainKind: string = "evm",
): LiveQuoteSettleResult {
  if (typeof live.context !== "string" || !live.context) {
    return { ok: false, reason: "missing_context" };
  }

  const depositAddress = live.quote.depositAddress?.trim() || "";
  if (!isAddressValid(depositAddress, chainKind)) {
    return { ok: false, reason: "invalid_deposit" };
  }

  const amountInRaw = live.quote.amountIn?.trim() || "";
  if (!POSITIVE_INT_STRING.test(amountInRaw)) {
    return { ok: false, reason: "invalid_amount" };
  }
  let amountIn: bigint;
  try {
    amountIn = BigInt(amountInRaw);
  } catch {
    return { ok: false, reason: "invalid_amount" };
  }
  if (amountIn <= 0n) return { ok: false, reason: "invalid_amount" };

  const deadlineMs = live.quote.deadline ? Date.parse(String(live.quote.deadline)) : Number.NaN;
  if (!Number.isFinite(deadlineMs) || deadlineMs <= nowMs) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, context: live.context, depositAddress, amountIn };
}

export function liveQuoteSettleErrorMessage(reason: Exclude<LiveQuoteSettleResult, { ok: true }>["reason"]): string {
  switch (reason) {
    case "missing_context":
      return "Live quote missing commit context";
    case "invalid_deposit":
      return "Quote missing deposit details";
    case "invalid_amount":
      return "Quote missing deposit details";
    case "expired":
      return "Quote expired; get a fresh quote and try again";
  }
}
