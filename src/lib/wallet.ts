// EVM wallet setup (wagmi + viem) — payment signing only; auth stays email+password

import { http, createConfig } from "wagmi";
import { base, arbitrum, polygon, optimism, mainnet, bsc } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const SUPPORTED_CHAINS = [
  { id: "Base", chain: base, icon: "$" },
  { id: "Arbitrum", chain: arbitrum, icon: "$" },
  { id: "Polygon", chain: polygon, icon: "$" },
  { id: "Optimism", chain: optimism, icon: "$" },
  { id: "Ethereum", chain: mainnet, icon: "Ξ" },
  { id: "BNB Chain", chain: bsc, icon: "₿" },
];

export const wagmiConfig = createConfig({
  chains: [base, arbitrum, polygon, optimism, mainnet, bsc],
  connectors: [injected()],
  transports: {
    [base.id]: http(),
    [arbitrum.id]: http(),
    [polygon.id]: http(),
    [optimism.id]: http(),
    [mainnet.id]: http(),
    [bsc.id]: http(),
  },
  ssr: false,
});

// Map our network names to wagmi chain ids
export function networkToChainId(network: string): number | null {
  const entry = SUPPORTED_CHAINS.find((s) => s.id === network);
  return entry ? entry.chain.id : null;
}

export function chainIdToNetwork(id: number): string {
  const entry = SUPPORTED_CHAINS.find((s) => s.chain.id === id);
  return entry ? entry.id : "Base";
}
