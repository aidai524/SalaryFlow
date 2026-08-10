/**
 * EVM wallet adapter backed by wagmi + RainbowKit.
 *
 * Message signing uses ERC-191 (`personal_sign`) via wagmi `signMessageAsync`.
 * Address validation uses viem `isAddress`.
 *
 * Business flows (payroll intents, payout ownership challenges) should call
 * through `useWallet("evm")` instead of importing wagmi hooks directly.
 */

import { useCallback, useMemo } from "react";
import { isAddress } from "viem";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { useOpenWalletModal } from "@/hooks/use-open-wallet-modal";
import type { SignMessageParams, SignMessageResult, UseWalletResult, WalletAccount } from "../types";

function toUtf8Message(message: string | Uint8Array): string {
  if (typeof message === "string") return message;
  return new TextDecoder().decode(message);
}

export function useEvmWallet(): UseWalletResult {
  const { address, chainId, isConnected, isConnecting, isReconnecting } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { openWalletModal } = useOpenWalletModal();

  const account = useMemo<WalletAccount | null>(() => {
    if (!address) return null;
    return {
      address,
      chainKind: "evm",
      chainId,
    };
  }, [address, chainId]);

  const signMessage = useCallback(
    async (params: SignMessageParams): Promise<SignMessageResult> => {
      if (!address) {
        throw new Error("[wallet:evm] No connected account to sign with.");
      }
      const signature = await signMessageAsync({ message: toUtf8Message(params.message) });
      return {
        signature,
        address,
        chainKind: "evm",
      };
    },
    [address, signMessageAsync],
  );

  return {
    kind: "evm",
    account,
    isConnected: Boolean(isConnected && address),
    isConnecting: isConnecting || isReconnecting,
    connect: openWalletModal,
    disconnect,
    signMessage,
    isAddressValid: (value) => isAddress(value),
  };
}
