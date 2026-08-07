// EVM → NEAR Intents account id.
// Matches @defuse-protocol/internal-utils authIdentity.authHandleToIntentsUserId(addr, "evm"):
// for EVM wallets the canonical Confidential account id is the lowercased address.

const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export function normalizeEvmAddress(address: string): string {
  const value = address.trim();
  if (!EVM_ADDRESS_PATTERN.test(value)) {
    throw new Error("Invalid EVM wallet address");
  }
  return value.toLowerCase();
}

export function toIntentsUserId(eoaAddress: string): string {
  return normalizeEvmAddress(eoaAddress);
}
