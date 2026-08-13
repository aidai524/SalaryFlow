import { describe, expect, it } from "vitest";
import {
  isDryQuoteStale,
  liveQuoteSettleErrorMessage,
  sameEthereumAddress,
  validateLiveQuoteForSettle,
} from "./utils";

describe("isDryQuoteStale", () => {
  it("is stale when the typed amount has not reached debounce", () => {
    expect(isDryQuoteStale({
      amountForQuote: "1000",
      debouncedAmountForQuote: "0.2",
      isPlaceholderData: false,
      isPending: false,
      isFetching: false,
    })).toBe(true);
  });

  it("is stale when showing placeholder data for a new query key", () => {
    expect(isDryQuoteStale({
      amountForQuote: "1000",
      debouncedAmountForQuote: "1000",
      isPlaceholderData: true,
      isPending: false,
      isFetching: true,
    })).toBe(true);
  });

  it("is stale while the first dry quote is pending", () => {
    expect(isDryQuoteStale({
      amountForQuote: "0.2",
      debouncedAmountForQuote: "0.2",
      isPlaceholderData: false,
      isPending: true,
      isFetching: true,
    })).toBe(true);
  });

  it("is not stale when the query is disabled (pending but idle)", () => {
    expect(isDryQuoteStale({
      amountForQuote: null,
      debouncedAmountForQuote: null,
      isPlaceholderData: false,
      isPending: true,
      isFetching: false,
    })).toBe(false);
  });

  it("is not stale on a background refetch of the current key", () => {
    expect(isDryQuoteStale({
      amountForQuote: "0.2",
      debouncedAmountForQuote: "0.2",
      isPlaceholderData: false,
      isPending: false,
      isFetching: true,
    })).toBe(false);
  });
});

describe("sameEthereumAddress", () => {
  const a = "0x1111111111111111111111111111111111111111";
  const b = "0x2222222222222222222222222222222222222222";

  it("treats mixed-case copies of the same address as equal", () => {
    expect(sameEthereumAddress(a, a.toUpperCase())).toBe(true);
  });

  it("rejects different addresses", () => {
    expect(sameEthereumAddress(a, b)).toBe(false);
  });

  it("rejects missing addresses", () => {
    expect(sameEthereumAddress(a, null)).toBe(false);
    expect(sameEthereumAddress(undefined, b)).toBe(false);
  });
});

describe("validateLiveQuoteForSettle", () => {
  const valid = {
    context: "ctx",
    quote: {
      depositAddress: "0x1111111111111111111111111111111111111111",
      amountIn: "1000000",
      deadline: new Date(Date.now() + 60_000).toISOString(),
    },
  };

  it("accepts a complete future live quote", () => {
    const result = validateLiveQuoteForSettle(valid);
    expect(result).toEqual({
      ok: true,
      context: "ctx",
      depositAddress: valid.quote.depositAddress,
      amountIn: 1000000n,
    });
  });

  it("rejects a missing context", () => {
    expect(validateLiveQuoteForSettle({ ...valid, context: undefined })).toEqual({
      ok: false,
      reason: "missing_context",
    });
  });

  it("rejects a non-integer amountIn", () => {
    expect(validateLiveQuoteForSettle({
      ...valid,
      quote: { ...valid.quote, amountIn: "1.5" },
    }).ok).toBe(false);
  });

  it("rejects an expired deadline", () => {
    expect(validateLiveQuoteForSettle({
      ...valid,
      quote: { ...valid.quote, deadline: new Date(Date.now() - 1000).toISOString() },
    })).toEqual({ ok: false, reason: "expired" });
  });

  it("maps reasons to settle error messages", () => {
    expect(liveQuoteSettleErrorMessage("expired")).toMatch(/expired/i);
    expect(liveQuoteSettleErrorMessage("missing_context")).toMatch(/context/i);
  });
});
