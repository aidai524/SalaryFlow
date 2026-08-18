/**
 * EVM wallet configuration (RainbowKit + wagmi + viem).
 *
 * Used for payment signing and payout ownership proofs on EVM chains.
 * Auth remains email + password — wallets are never used for login.
 */

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
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
} from "wagmi/chains";

const chains = [base, arbitrum, polygon, optimism, mainnet, bsc, avalanche, gnosis, scroll] as const;

export const wagmiConfig = getDefaultConfig({
  appName: "Stableflow Pay",
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "00000000000000000000000000000000",
  chains,
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [arbitrum.id]: http(),
    [gnosis.id]: http(),
    [berachain.id]: http(),
    [bsc.id]: http(),
    [monad.id]: http(),
    [xLayer.id]: http(),
    [plasma.id]: http(),
    [polygon.id]: http(),
    [optimism.id]: http(),
    [avalanche.id]: http(),
    [scroll.id]: http(),
  },
  ssr: false,
});
