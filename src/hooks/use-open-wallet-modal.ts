import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useEffect, useRef } from "react";
import { useAccount, useDisconnect } from "wagmi";

/**
 * RainbowKit's openConnectModal is only defined when disconnected.
 * When already connected, disconnect first, then open the connect modal.
 */
export function useOpenWalletModal() {
  const { openConnectModal } = useConnectModal();
  const { isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const pendingOpenConnectRef = useRef(false);

  useEffect(() => {
    if (!isConnected && pendingOpenConnectRef.current && openConnectModal) {
      pendingOpenConnectRef.current = false;
      openConnectModal();
    }
  }, [isConnected, openConnectModal]);

  const openWalletModal = () => {
    if (isConnected) {
      pendingOpenConnectRef.current = true;
      disconnect();
      return;
    }
    openConnectModal?.();
  };

  return { openWalletModal, isConnected };
}
