import { useWallet as useSolanaAdapter } from "@solana/wallet-adapter-react";
import { useWalletModal as useSolanaWalletModal } from "@solana/wallet-adapter-react-ui";
import { useCallback, useMemo } from "react";
import { isAddressValid } from "@/lib/address-validation";
import type { SignMessageParams, SignMessageResult, UseWalletResult, WalletAccount } from "../types";

function toBytes(message: string | Uint8Array): Uint8Array {
  if (typeof message === "string") return new TextEncoder().encode(message);
  return message;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function useSolanaWallet(): UseWalletResult {
  const {
    publicKey,
    connected,
    connecting,
    disconnect,
    signMessage,
    select,
  } = useSolanaAdapter();
  const { setVisible, visible } = useSolanaWalletModal();

  const address = publicKey?.toBase58() || null;

  const account = useMemo<WalletAccount | null>(() => {
    if (!address) return null;
    return { address, chainKind: "solana", chainId: "mainnet-beta" };
  }, [address]);

  const connect = useCallback(() => {
    const openModal = () => setVisible(true);
    if (connected) {
      void Promise.resolve(disconnect()).finally(() => {
        select(null);
        openModal();
      });
      return;
    }
    openModal();
  }, [connected, disconnect, select, setVisible]);

  const sign = useCallback(
    async (params: SignMessageParams): Promise<SignMessageResult> => {
      if (!address || !publicKey) {
        throw new Error("[wallet:solana] No connected account to sign with.");
      }
      if (!signMessage) {
        throw new Error("[wallet:solana] Connected wallet does not support message signing.");
      }
      const signature = await signMessage(toBytes(params.message));
      return {
        signature: bytesToBase64(signature),
        address,
        chainKind: "solana",
        publicKey: address,
      };
    },
    [address, publicKey, signMessage],
  );

  const isAddressValidFn = useCallback((value: string) => isAddressValid(value, "solana"), []);

  return useMemo<UseWalletResult>(() => ({
    kind: "solana",
    account,
    isConnected: Boolean(connected && address),
    isConnecting: connecting,
    isModalOpen: visible,
    connect,
    disconnect,
    signMessage: sign,
    isAddressValid: isAddressValidFn,
  }), [
    account,
    address,
    connect,
    connected,
    connecting,
    disconnect,
    isAddressValidFn,
    sign,
    visible,
  ]);
}
