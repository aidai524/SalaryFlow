/**
 * Root wallet provider tree.
 *
 * Current: EVM via WagmiProvider + RainbowKitProvider.
 * Future: nest NEAR / Solana providers here without changing page components.
 *
 * Example extension:
 *   <WagmiProvider>
 *     <RainbowKitProvider>
 *       <NearWalletProvider>      // TODO
 *         <SolanaWalletProvider>  // TODO
 *           {children}
 *         </SolanaWalletProvider>
 *       </NearWalletProvider>
 *     </RainbowKitProvider>
 *   </WagmiProvider>
 */

import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import type { ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "./evm/config";

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <RainbowKitProvider>{children}</RainbowKitProvider>
    </WagmiProvider>
  );
}
