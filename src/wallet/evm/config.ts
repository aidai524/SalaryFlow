/**
 * EVM wallet configuration (RainbowKit + wagmi + viem).
 *
 * Used for payment signing and payout ownership proofs on EVM chains.
 * Auth remains email + password — wallets are never used for login.
 */

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { arbitrum, base, bsc, mainnet, optimism, polygon } from "wagmi/chains";

export const SUPPORTED_CHAINS = [
  { id: "Base", chain: base, icon: "$" },
  { id: "Arbitrum", chain: arbitrum, icon: "$" },
  { id: "Polygon", chain: polygon, icon: "$" },
  { id: "Optimism", chain: optimism, icon: "$" },
  { id: "Ethereum", chain: mainnet, icon: "Ξ" },
  { id: "BNB Chain", chain: bsc, icon: "₿" },
] as const;

const chains = [base, arbitrum, polygon, optimism, mainnet, bsc] as const;

export const wagmiConfig = getDefaultConfig({
  appName: "DECash",
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

export function networkToChainId(network: string): number | null {
  const entry = SUPPORTED_CHAINS.find((item) => item.id === network);
  return entry ? entry.chain.id : null;
}

export function chainIdToNetwork(id: number): string {
  const entry = SUPPORTED_CHAINS.find((item) => item.chain.id === id);
  return entry ? entry.id : "Base";
}
