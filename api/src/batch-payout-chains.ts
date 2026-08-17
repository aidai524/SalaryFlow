/**
 * Admin origin chains that have a BatchPayout contract.
 * Keep in sync with src/config/batch-payout-chains.ts (do not import across packages).
 */

export const BATCH_PAYOUT_PLANNED = [
  "arb",
  "op",
  "eth",
  "avax",
  "base",
  "bsc",
  "gnosis",
  "pol",
  "monad",
  "xlayer",
  "bera",
  "scroll",
  "plasma",
] as const;

export type BatchPayoutBlockchain = (typeof BATCH_PAYOUT_PLANNED)[number];

export interface BatchPayoutContractConfig {
  chainId: number;
  address: `0x${string}`;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const BATCH_PAYOUT_CONTRACTS: Partial<Record<BatchPayoutBlockchain, BatchPayoutContractConfig>> = {
  arb: { chainId: 42161, address: "0x5A1D9d70E23F886074Ff29Fcaf241cdb73CF4090" },
  eth: { chainId: 1, address: "0x5A1D9d70E23F886074Ff29Fcaf241cdb73CF4090" },
  bsc: { chainId: 56, address: "0x5A1D9d70E23F886074Ff29Fcaf241cdb73CF4090" },
};

export const BATCH_PAYOUT_MAX_ITEMS = 50;

function isZeroAddress(address: string | null | undefined): boolean {
  return !address || address.toLowerCase() === ZERO_ADDRESS;
}

export function getBatchPayoutContract(blockchain: string): BatchPayoutContractConfig | null {
  const entry = BATCH_PAYOUT_CONTRACTS[blockchain as BatchPayoutBlockchain];
  if (!entry || isZeroAddress(entry.address)) return null;
  return entry;
}

export function isBatchPayoutOriginEnabled(blockchain: string): boolean {
  return getBatchPayoutContract(blockchain) != null;
}

/** Resolve 1Click blockchain code from display network or code. */
export function blockchainFromOriginNetwork(originNetwork: string): string {
  const raw = String(originNetwork || "").trim();
  const lower = raw.toLowerCase();
  const map: Record<string, string> = {
    ethereum: "eth",
    eth: "eth",
    base: "base",
    arbitrum: "arb",
    arb: "arb",
    optimism: "op",
    op: "op",
    polygon: "pol",
    pol: "pol",
    "bnb chain": "bsc",
    bsc: "bsc",
    avalanche: "avax",
    avax: "avax",
    gnosis: "gnosis",
    scroll: "scroll",
    monad: "monad",
    "x layer": "xlayer",
    xlayer: "xlayer",
    plasma: "plasma",
    berachain: "bera",
    bera: "bera",
  };
  return map[lower] || lower;
}

export function resolveBatchPayoutContract(originNetwork: string): BatchPayoutContractConfig | null {
  return getBatchPayoutContract(blockchainFromOriginNetwork(originNetwork));
}
