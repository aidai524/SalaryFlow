/**
 * Admin origin chains that have a BatchPayout contract.
 * Employee destination chains stay dynamic from 1Click.
 *
 * Fill `address` after `forge script` deploy. Zero / missing address = not enabled.
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

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

/** Deployed BatchPayout addresses keyed by 1Click blockchain code. */
export const BATCH_PAYOUT_CONTRACTS: Partial<Record<BatchPayoutBlockchain, BatchPayoutContractConfig>> = {
  // Fill after Arbitrum mainnet deploy.
  arb: { chainId: 42161, address: "0x5A1D9d70E23F886074Ff29Fcaf241cdb73CF4090" },
};

export const BATCH_PAYOUT_MAX_ITEMS = 50;

export const BATCH_PAYOUT_ABI = [
  {
    type: "function",
    name: "execute",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "tos", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
      { name: "batchId", type: "bytes32" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export function isZeroAddress(address: string | null | undefined): boolean {
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

export function enabledBatchPayoutBlockchains(): string[] {
  return BATCH_PAYOUT_PLANNED.filter((code) => isBatchPayoutOriginEnabled(code));
}
