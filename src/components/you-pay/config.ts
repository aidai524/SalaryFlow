import type { StableSymbol } from "@/stores/intents-tokens";

/** Default You Pay origin when no preference is saved (Quick Pay + Batch Payout). */
export const ORIGIN_TOKEN_FALLBACKS: ReadonlyArray<{
  blockchain: string;
  symbol: StableSymbol;
}> = [
  { blockchain: "eth", symbol: "USDT" },
  { blockchain: "base", symbol: "USDC" },
  { blockchain: "arb", symbol: "USDT" },
];
