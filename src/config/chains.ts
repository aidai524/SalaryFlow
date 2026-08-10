/**
 * Chain registry for DECash payments.
 * Phase 1: EVM only. Non-EVM kinds are reserved for later wallet adapters.
 */

import { chainLogoUrl } from "@/lib/logo";

export type ChainKind = "evm" | "near" | "solana" | "other";

export interface ChainConfig {
  /** 1Click blockchain code (e.g. arb, base). */
  blockchain: string;
  /** Display name used in UI / legacy employee.network. */
  chainName: string;
  chainKind: ChainKind;
  /** EVM chain id when applicable. */
  chainId?: number;
  logo: string;
}

/** Phase-1 EVM chains supporting USDT/USDC via 1Click. */
export const PHASE1_CHAINS: ChainConfig[] = [
  { blockchain: "eth", chainName: "Ethereum", chainKind: "evm", chainId: 1, logo: chainLogoUrl("eth") },
  { blockchain: "base", chainName: "Base", chainKind: "evm", chainId: 8453, logo: chainLogoUrl("base") },
  { blockchain: "arb", chainName: "Arbitrum", chainKind: "evm", chainId: 42161, logo: chainLogoUrl("arb") },
  { blockchain: "op", chainName: "Optimism", chainKind: "evm", chainId: 10, logo: chainLogoUrl("op") },
  { blockchain: "pol", chainName: "Polygon", chainKind: "evm", chainId: 137, logo: chainLogoUrl("pol") },
  { blockchain: "bsc", chainName: "BNB Chain", chainKind: "evm", chainId: 56, logo: chainLogoUrl("bsc") },
  { blockchain: "avax", chainName: "Avalanche", chainKind: "evm", chainId: 43114, logo: chainLogoUrl("avax") },
  { blockchain: "gnosis", chainName: "Gnosis", chainKind: "evm", chainId: 100, logo: chainLogoUrl("gnosis") },
  { blockchain: "scroll", chainName: "Scroll", chainKind: "evm", chainId: 534352, logo: chainLogoUrl("scroll") },
  { blockchain: "monad", chainName: "Monad", chainKind: "evm", chainId: 143, logo: chainLogoUrl("monad") },
  { blockchain: "xlayer", chainName: "X Layer", chainKind: "evm", chainId: 196, logo: chainLogoUrl("xlayer") },
  { blockchain: "plasma", chainName: "Plasma", chainKind: "evm", logo: chainLogoUrl("plasma") },
  { blockchain: "bera", chainName: "Berachain", chainKind: "evm", chainId: 80094, logo: chainLogoUrl("bera") },
];

const byBlockchain = new Map(PHASE1_CHAINS.map((c) => [c.blockchain, c]));
const byChainName = new Map(PHASE1_CHAINS.map((c) => [c.chainName.toLowerCase(), c]));

export function getChainByBlockchain(blockchain: string): ChainConfig | undefined {
  return byBlockchain.get(blockchain);
}

export function getChainByNetwork(network: string): ChainConfig | undefined {
  return byChainName.get(String(network || "").toLowerCase())
    || byBlockchain.get(String(network || "").toLowerCase());
}

export function networkToChainId(network: string): number | null {
  return getChainByNetwork(network)?.chainId ?? null;
}
