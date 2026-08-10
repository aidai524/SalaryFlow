/**
 * Unified wallet hook for UI and payment flows.
 *
 *   const wallet = useWallet("evm");
 *   await wallet.signMessage({ message: challenge });
 *
 * Pass `"near"` or `"solana"` once those adapters are registered.
 */

import { useEvmWallet } from "./evm/adapter";
import { UnsupportedChainError, type ChainKind, type UseWalletResult } from "./types";

function unsupportedWallet(kind: Exclude<ChainKind, "evm">): UseWalletResult {
  const fail = (action: string) => () => {
    throw new UnsupportedChainError(kind, action);
  };

  return {
    kind,
    account: null,
    isConnected: false,
    isConnecting: false,
    connect: fail("connect"),
    disconnect: fail("disconnect"),
    signMessage: async () => {
      throw new UnsupportedChainError(kind, "signMessage");
    },
    isAddressValid: () => false,
  };
}

export function useWallet(chainKind: ChainKind = "evm"): UseWalletResult {
  // Always call the EVM hook so Rules of Hooks stay stable.
  // When adding NEAR/Solana, call those hooks unconditionally here too.
  const evm = useEvmWallet();

  switch (chainKind) {
    case "evm":
      return evm;
    case "near":
      return unsupportedWallet("near");
    case "solana":
      return unsupportedWallet("solana");
    default: {
      const _exhaustive: never = chainKind;
      return _exhaustive;
    }
  }
}
