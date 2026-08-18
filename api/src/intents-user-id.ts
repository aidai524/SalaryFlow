// Wallet address → NEAR Intents account id.
// EVM: lowercased 0x address (matches @defuse-protocol/internal-utils).
// Near: lowercased account id. Solana: case-sensitive base58 pubkey.

import { resolveChainKind, type WalletChainKind } from "./address-validation";

const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export function normalizeEvmAddress(address: string): string {
  const value = address.trim();
  if (!EVM_ADDRESS_PATTERN.test(value)) {
    throw new Error("Invalid EVM wallet address");
  }
  return value.toLowerCase();
}

export function toIntentsUserId(
  address: string,
  chainKind: WalletChainKind | string | null | undefined = "evm",
): string {
  const kind = resolveChainKind(chainKind) || "evm";
  const value = address.trim();
  if (kind === "evm") return normalizeEvmAddress(value);
  if (kind === "near") {
    if (!value) throw new Error("Invalid NEAR wallet address");
    return value.toLowerCase();
  }
  if (!value) throw new Error("Invalid Solana wallet address");
  return value;
}
