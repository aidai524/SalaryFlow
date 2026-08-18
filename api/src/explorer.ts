/**
 * Block-explorer helpers aligned with PHASE1_CHAINS / TokenNetworkDialog networks.
 * Unknown networks return null — never invent a default explorer.
 */

type ChainExplorer = {
  blockchain: string;
  chainName: string;
  chainId?: number;
  /** Full prefix including trailing path before the tx hash. */
  txUrlPrefix: string;
  /** Extra lowercase aliases matched via includes / exact. */
  aliases?: string[];
  /** EVM explorers expect 0x-prefixed hashes; Near/Solana do not. */
  hashKind?: "hex" | "raw";
};

const PHASE1_EXPLORERS: ChainExplorer[] = [
  {
    blockchain: "eth",
    chainName: "Ethereum",
    chainId: 1,
    txUrlPrefix: "https://etherscan.io/tx/",
    aliases: ["ethereum", "mainnet"],
  },
  {
    blockchain: "base",
    chainName: "Base",
    chainId: 8453,
    txUrlPrefix: "https://basescan.org/tx/",
  },
  {
    blockchain: "arb",
    chainName: "Arbitrum",
    chainId: 42161,
    txUrlPrefix: "https://arbiscan.io/tx/",
    aliases: ["arbitrum"],
  },
  {
    blockchain: "op",
    chainName: "Optimism",
    chainId: 10,
    txUrlPrefix: "https://optimistic.etherscan.io/tx/",
    aliases: ["optimism"],
  },
  {
    blockchain: "pol",
    chainName: "Polygon",
    chainId: 137,
    txUrlPrefix: "https://polygonscan.com/tx/",
    aliases: ["polygon", "matic"],
  },
  {
    blockchain: "bsc",
    chainName: "BNB Chain",
    chainId: 56,
    txUrlPrefix: "https://bscscan.com/tx/",
    aliases: ["bnb", "binance"],
  },
  {
    blockchain: "avax",
    chainName: "Avalanche",
    chainId: 43114,
    txUrlPrefix: "https://snowtrace.io/tx/",
    aliases: ["avalanche"],
  },
  {
    blockchain: "gnosis",
    chainName: "Gnosis",
    chainId: 100,
    txUrlPrefix: "https://gnosisscan.io/tx/",
  },
  {
    blockchain: "scroll",
    chainName: "Scroll",
    chainId: 534352,
    txUrlPrefix: "https://scrollscan.com/tx/",
  },
  {
    blockchain: "monad",
    chainName: "Monad",
    chainId: 143,
    txUrlPrefix: "https://monadscan.com/tx/",
  },
  {
    blockchain: "xlayer",
    chainName: "X Layer",
    chainId: 196,
    txUrlPrefix: "https://www.okx.com/web3/explorer/xlayer/tx/",
    aliases: ["x layer", "x-layer"],
  },
  {
    blockchain: "plasma",
    chainName: "Plasma",
    chainId: 9745,
    txUrlPrefix: "https://plasmascan.to/tx/",
  },
  {
    blockchain: "bera",
    chainName: "Berachain",
    chainId: 80094,
    txUrlPrefix: "https://berascan.com/tx/",
    aliases: ["berachain"],
  },
  {
    blockchain: "near",
    chainName: "Near",
    txUrlPrefix: "https://nearblocks.io/txns/",
    aliases: ["near"],
    hashKind: "raw",
  },
  {
    blockchain: "sol",
    chainName: "Solana",
    txUrlPrefix: "https://solscan.io/tx/",
    aliases: ["solana", "sol"],
    hashKind: "raw",
  },
];

const byBlockchain = new Map(PHASE1_EXPLORERS.map((c) => [c.blockchain, c]));
const byChainId = new Map(
  PHASE1_EXPLORERS.filter((c) => c.chainId != null).map((c) => [c.chainId!, c]),
);

function normalizeHash(txHash: string, hashKind: "hex" | "raw" = "hex"): string {
  if (hashKind === "raw") return txHash;
  return txHash.startsWith("0x") ? txHash : `0x${txHash}`;
}

function resolveExplorer(networkOrCode: string): ChainExplorer | null {
  const raw = String(networkOrCode || "").trim();
  if (!raw) return null;
  const n = raw.toLowerCase();

  const exactCode = byBlockchain.get(n);
  if (exactCode) return exactCode;

  for (const chain of PHASE1_EXPLORERS) {
    if (n === chain.chainName.toLowerCase()) return chain;
  }

  // Prefer longer / more specific aliases first to avoid "base" in unrelated strings.
  // Match order: exact alias, then includes on chainName / aliases / blockchain code as token.
  for (const chain of PHASE1_EXPLORERS) {
    if (chain.aliases?.some((a) => n === a)) return chain;
  }
  for (const chain of PHASE1_EXPLORERS) {
    if (n.includes(chain.chainName.toLowerCase())) return chain;
  }
  for (const chain of PHASE1_EXPLORERS) {
    if (chain.aliases?.some((a) => n.includes(a))) return chain;
  }
  // Token-boundary match for short codes (arb, op, eth, bsc, …) inside nep141:{code}-…
  for (const chain of PHASE1_EXPLORERS) {
    const code = chain.blockchain;
    if (new RegExp(`(^|[^a-z0-9])${code}([^a-z0-9]|$)`).test(n)) return chain;
  }

  return null;
}

/** Build a block-explorer URL for a tx on a known payment network or blockchain code. */
export function explorerUrlForTx(networkOrCode: string, txHash: string): string | null {
  const chain = resolveExplorer(networkOrCode);
  if (!chain || !txHash) return null;
  return `${chain.txUrlPrefix}${normalizeHash(txHash, chain.hashKind ?? "hex")}`;
}

/**
 * Infer display/network hint from a 1Click origin asset id
 * (e.g. nep141:arb-0x….omft.near or nep245:v2_1.omni.hot.tg:56_…).
 * Returns chainName when possible so explorerUrlForTx can resolve it.
 */
export function networkHintFromOriginAssetId(
  originAssetId: string | null | undefined,
): string | null {
  if (!originAssetId) return null;
  const id = originAssetId.toLowerCase();

  // nep245 / omni style: …:{chainId}_… or …:{chainId}-…
  const chainIdMatch = id.match(/:(\d+)[_-]/);
  if (chainIdMatch) {
    const chainId = Number(chainIdMatch[1]);
    const byId = byChainId.get(chainId);
    if (byId) return byId.chainName;
  }

  // nep141:{blockchain}-… and other embeds of PHASE1 codes / names
  const fromCode = resolveExplorer(id);
  if (fromCode) return fromCode.chainName;

  // Explicit longer names not caught by short-code regex alone
  if (id.includes("arbitrum")) return "Arbitrum";
  if (id.includes("optimism")) return "Optimism";
  if (id.includes("polygon") || id.includes("matic")) return "Polygon";
  if (id.includes("binance") || id.includes("bnb")) return "BNB Chain";
  if (id.includes("avalanche")) return "Avalanche";
  if (id.includes("berachain")) return "Berachain";
  if (id.includes("ethereum")) return "Ethereum";
  if (id.includes("solana") || /\bsol\b/.test(id)) return "Solana";
  if (id.includes("near")) return "Near";

  return null;
}
