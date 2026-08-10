// EVM wallet setup (RainbowKit + wagmi + viem) — payment signing only; auth stays email+password

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { base, arbitrum, polygon, optimism, mainnet, bsc } from "wagmi/chains";

export const SUPPORTED_CHAINS = [
  { id: "Base", chain: base, icon: "$" },
  { id: "Arbitrum", chain: arbitrum, icon: "$" },
  { id: "Polygon", chain: polygon, icon: "$" },
  { id: "Optimism", chain: optimism, icon: "$" },
  { id: "Ethereum", chain: mainnet, icon: "Ξ" },
  { id: "BNB Chain", chain: bsc, icon: "₿" },
];

const chains = [base, arbitrum, polygon, optimism, mainnet, bsc] as const;

export const wagmiConfig = getDefaultConfig({
  appName: "SalaryFlow",
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "00000000000000000000000000000000",
  chains,
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
