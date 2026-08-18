/**
 * Unified wallet hook for UI and payment flows.
 *
 *   const wallet = useWallet("evm");
 *   await wallet.signMessage({ message: challenge });
 */

import { useEvmWallet } from "./evm/adapter";
import { useNearWallet } from "./near/adapter";
import { useSolanaWallet } from "./solana/adapter";
import type { ChainKind, UseWalletResult } from "./types";

export function useWallet(chainKind: ChainKind = "evm"): UseWalletResult {
  const evm = useEvmWallet();
  const near = useNearWallet();
  const solana = useSolanaWallet();

  switch (chainKind) {
    case "evm":
      return evm;
    case "near":
      return near;
    case "solana":
      return solana;
    default: {
      const _exhaustive: never = chainKind;
      return _exhaustive;
    }
  }
}
