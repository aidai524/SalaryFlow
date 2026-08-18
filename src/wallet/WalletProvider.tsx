/**
 * Root wallet provider tree.
 *
 * Wagmi/RainbowKit (EVM) wraps Solana and Near adapters so UI can connect
 * any of the three without page-level provider changes.
 */

import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import type { ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "./evm/config";
import { NearWalletProvider } from "./near/provider";
import { SolanaWalletProvider } from "./solana/provider";

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <RainbowKitProvider>
        <SolanaWalletProvider>
          <NearWalletProvider>{children}</NearWalletProvider>
        </SolanaWalletProvider>
      </RainbowKitProvider>
    </WagmiProvider>
  );
}
