/**
 * EVM ERC-20 transfer + balance helpers for Quick Pay ORIGIN_CHAIN deposits.
 * Prefer these from payment UI instead of scattering wagmi calls.
 */

import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  http,
  type Address,
  type Chain,
  type Hex,
} from "viem";
import {
  arbitrum,
  avalanche,
  base,
  berachain,
  bsc,
  gnosis,
  mainnet,
  monad,
  optimism,
  plasma,
  polygon,
  scroll,
  xLayer,
} from "viem/chains";
import { getChainByNetwork } from "@/config/chains";

const chainById: Record<number, Chain> = {
  [mainnet.id]: mainnet,
  [base.id]: base,
  [arbitrum.id]: arbitrum,
  [gnosis.id]: gnosis,
  [berachain.id]: berachain,
  [bsc.id]: bsc,
  [monad.id]: monad,
  [xLayer.id]: xLayer,
  [plasma.id]: plasma,
  [polygon.id]: polygon,
  [optimism.id]: optimism,
  [avalanche.id]: avalanche,
  [scroll.id]: scroll,
};

function resolveChain(networkOrBlockchain: string): Chain | null {
  const chainId = getChainByNetwork(networkOrBlockchain)?.chainId;
  if (!chainId) return null;
  return chainById[chainId] ?? null;
}

export function getPublicClientForNetwork(networkOrBlockchain: string) {
  const chain = resolveChain(networkOrBlockchain);
  if (!chain) return null;
  return createPublicClient({
    chain,
    transport: http(),
  });
}

export async function readErc20Balance(opts: {
  network: string;
  tokenAddress: Address;
  owner: Address;
  decimals: number;
}): Promise<{ raw: bigint; formatted: string }> {
  const client = getPublicClientForNetwork(opts.network);
  if (!client) throw new Error(`Unsupported network: ${opts.network}`);
  const raw = await client.readContract({
    address: opts.tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [opts.owner],
  });
  return { raw, formatted: formatUnits(raw, opts.decimals) };
}

export function encodeErc20Transfer(to: Address, amount: bigint): Hex {
  return encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, amount],
  });
}

export function encodeErc20Approve(spender: Address, amount: bigint): Hex {
  return encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, amount],
  });
}

export async function readErc20Allowance(opts: {
  network: string;
  tokenAddress: Address;
  owner: Address;
  spender: Address;
}): Promise<bigint> {
  const client = getPublicClientForNetwork(opts.network);
  if (!client) throw new Error(`Unsupported network: ${opts.network}`);
  return client.readContract({
    address: opts.tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [opts.owner, opts.spender],
  });
}

export { erc20Abi };
