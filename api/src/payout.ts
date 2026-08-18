import { NETWORK_TO_BLOCKCHAIN } from "./assets";
import { normalizeAddress, resolveChainKind, type WalletChainKind } from "./address-validation";

export const PAYOUT_TOKENS = new Set(["USDC", "USDT"]);
export const PAYOUT_NETWORKS = new Set(Object.keys(NETWORK_TO_BLOCKCHAIN));
/** @deprecated Use PAYOUT_NETWORKS. Kept for existing imports. */
export const EVM_PAYOUT_NETWORKS = PAYOUT_NETWORKS;

export function normalizePayoutAddress(
  value: unknown,
  networkOrKind: string | null | undefined,
): string | null {
  return normalizeAddress(value, networkOrKind);
}

export function normalizePayoutToken(value: unknown): "USDC" | "USDT" | null {
  const token = String(value ?? "");
  return PAYOUT_TOKENS.has(token) ? token as "USDC" | "USDT" : null;
}

export function normalizePayoutNetwork(value: unknown): string | null {
  const network = String(value ?? "");
  return PAYOUT_NETWORKS.has(network) ? network : null;
}

export function payoutChainKind(networkOrKind: string | null | undefined): WalletChainKind | null {
  return resolveChainKind(networkOrKind);
}
