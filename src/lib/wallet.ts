/**
 * Backward-compatible re-export.
 * Prefer importing from `@/wallet` in new code.
 */
export {
  chainIdToNetwork,
  networkToChainId,
  SUPPORTED_CHAINS,
  wagmiConfig,
} from "@/wallet";
