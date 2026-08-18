// Stablecoin / chain allowlists for NEAR Intents 1Click.
// Registered chains: phase-1 EVM plus Near / Solana. Token list still comes from /v0/tokens.

export type ChainKind = "evm" | "near" | "solana" | "other";

export type StableSymbol = "USDC" | "USDT";

/** 1Click blockchain codes allowed for EVM origin/destination. */
export const PHASE1_EVM_BLOCKCHAINS = new Set([
  "eth",
  "base",
  "arb",
  "op",
  "pol",
  "bsc",
  "avax",
  "gnosis",
  "scroll",
  "monad",
  "xlayer",
  "plasma",
  "bera",
]);

/** Registered 1Click blockchain codes (EVM + Near + Solana). */
export const PHASE1_BLOCKCHAINS = new Set([
  ...PHASE1_EVM_BLOCKCHAINS,
  "near",
  "sol",
]);

/** Display network name (legacy payout enum) → 1Click blockchain code. */
export const NETWORK_TO_BLOCKCHAIN: Record<string, string> = {
  Ethereum: "eth",
  Base: "base",
  Arbitrum: "arb",
  Optimism: "op",
  Polygon: "pol",
  "BNB Chain": "bsc",
  Avalanche: "avax",
  Gnosis: "gnosis",
  Scroll: "scroll",
  Monad: "monad",
  "X Layer": "xlayer",
  Plasma: "plasma",
  Berachain: "bera",
  Near: "near",
  Solana: "sol",
};

/** 1Click blockchain code → display network name. */
export const BLOCKCHAIN_TO_NETWORK: Record<string, string> = Object.fromEntries(
  Object.entries(NETWORK_TO_BLOCKCHAIN).map(([network, chain]) => [chain, network]),
);

export function chainKindForBlockchain(blockchain: string): ChainKind {
  if (PHASE1_EVM_BLOCKCHAINS.has(blockchain)) return "evm";
  if (blockchain === "near") return "near";
  if (blockchain === "sol") return "solana";
  return "other";
}

export function chainKindForNetwork(network: string): ChainKind | null {
  const blockchain = NETWORK_TO_BLOCKCHAIN[network] || (PHASE1_BLOCKCHAINS.has(network) ? network : null);
  if (!blockchain) return null;
  const kind = chainKindForBlockchain(blockchain);
  return kind === "other" ? null : kind;
}

export function isPhase1Blockchain(blockchain: string): boolean {
  return PHASE1_BLOCKCHAINS.has(blockchain);
}

/** Normalize provider symbols: USDT0 → USDT. */
export function normalizeStableSymbol(symbol: string): StableSymbol | null {
  const upper = String(symbol || "").trim().toUpperCase();
  if (upper === "USDC") return "USDC";
  if (upper === "USDT" || upper === "USDT0") return "USDT";
  return null;
}

export function isPhase1EvmBlockchain(blockchain: string): boolean {
  return PHASE1_EVM_BLOCKCHAINS.has(blockchain);
}

export interface ProviderTokenMeta {
  assetId: string;
  decimals: number;
  blockchain: string;
  symbol: string;
  price?: number;
  contractAddress?: string | null;
}

export interface ResolvedStableAsset {
  assetId: string;
  decimals: number;
  blockchain: string;
  network: string;
  symbol: StableSymbol;
  providerSymbol: string;
  contractAddress: string | null;
  chainKind: ChainKind;
}

/** Filter 1Click tokens to registered-chain USDT/USDC (USDT0 counted as USDT). */
export function filterPhase1StableTokens(tokens: ProviderTokenMeta[]): ResolvedStableAsset[] {
  const resolved: ResolvedStableAsset[] = [];
  for (const token of tokens) {
    if (!isPhase1Blockchain(token.blockchain)) continue;
    const symbol = normalizeStableSymbol(token.symbol);
    if (!symbol) continue;
    const network = BLOCKCHAIN_TO_NETWORK[token.blockchain];
    if (!network) continue;
    const chainKind = chainKindForBlockchain(token.blockchain);
    if (chainKind === "other") continue;
    resolved.push({
      assetId: token.assetId,
      decimals: token.decimals,
      blockchain: token.blockchain,
      network,
      symbol,
      providerSymbol: token.symbol,
      contractAddress: token.contractAddress ?? null,
      chainKind,
    });
  }
  return resolved;
}

export function findStableAsset(
  tokens: ProviderTokenMeta[],
  opts: { assetId?: string; blockchain?: string; symbol?: StableSymbol },
): ResolvedStableAsset | null {
  const list = filterPhase1StableTokens(tokens);
  if (opts.assetId) {
    return list.find((t) => t.assetId === opts.assetId) || null;
  }
  if (opts.blockchain && opts.symbol) {
    return list.find((t) => t.blockchain === opts.blockchain && t.symbol === opts.symbol) || null;
  }
  return null;
}

export function findStableAssetByNetwork(
  tokens: ProviderTokenMeta[],
  network: string,
  symbol: StableSymbol,
): ResolvedStableAsset | null {
  const blockchain = NETWORK_TO_BLOCKCHAIN[network];
  if (!blockchain) return null;
  return findStableAsset(tokens, { blockchain, symbol });
}
