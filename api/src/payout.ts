import { getAddress, isAddress } from "viem";

export const PAYOUT_TOKENS = new Set(["USDC", "USDT"]);
export const EVM_PAYOUT_NETWORKS = new Set(["Base", "Arbitrum", "Polygon", "Optimism", "Ethereum", "BNB Chain"]);

export function normalizePayoutAddress(value: unknown): string | null {
  const address = String(value ?? "").trim();
  if (!isAddress(address)) return null;
  return getAddress(address);
}

export function normalizePayoutToken(value: unknown): "USDC" | "USDT" | null {
  const token = String(value ?? "");
  return PAYOUT_TOKENS.has(token) ? token as "USDC" | "USDT" : null;
}

export function normalizePayoutNetwork(value: unknown): string | null {
  const network = String(value ?? "");
  return EVM_PAYOUT_NETWORKS.has(network) ? network : null;
}
