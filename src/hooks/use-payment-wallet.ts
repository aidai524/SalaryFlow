import { useCallback, useEffect, useRef, useState } from "react";
import { sameAddress } from "@/lib/address-validation";
import { bindingForKind, withWalletBinding, withoutWalletBinding } from "@/lib/admin-wallets";
import { QUICK_PAY_TOAST } from "@/components/quick-pay/config";
import { useEvmWalletInfo } from "@/hooks/use-evm-wallet-info";
import useToast from "@/hooks/use-toast";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { useWallet, type ChainKind } from "@/wallet";

export function usePaymentWallet(chainKind: ChainKind = "evm") {
  const wallet = useWallet(chainKind);
  const walletInfo = useEvmWalletInfo();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const bound = bindingForKind(user, chainKind);
  const boundAddress = bound?.address || null;
  const boundKind = boundAddress ? chainKind : ((user?.wallet_chain_kind || "evm") as ChainKind);
  const [pendingBind, setPendingBind] = useState(false);
  const [bindingWallet, setBindingWallet] = useState(false);
  const modalWasOpen = useRef(false);
  const bindKeyRef = useRef<string | null>(null);
  const connectedRef = useRef(false);
  const connectingRef = useRef(false);

  const isAddressValid = wallet.isAddressValid;
  const connectedAddress = wallet.account?.address || null;
  const isConnected = wallet.isConnected;
  const isConnecting = wallet.isConnecting;
  const isModalOpen = wallet.isModalOpen;
  const connectWallet = wallet.connect;
  connectedRef.current = isConnected;
  connectingRef.current = isConnecting;

  const bindConnectedWallet = useCallback(async (address: string, kind: ChainKind = chainKind) => {
    if (!isAddressValid(address)) {
      throw new Error("Connected wallet is not a valid address for this network");
    }
    const current = useAuthStore.getState().user;
    const existing = bindingForKind(current, kind);
    if (existing && sameAddress(existing.address, address, kind)) {
      if (
        current
        && (current.wallet_chain_kind !== kind
          || current.wallet_address !== existing.address
          || current.wallet_verified !== existing.verified)
      ) {
        setUser(withWalletBinding(current, kind, existing.address, existing.verified, current.wallets));
      }
      return existing.address;
    }
    setBindingWallet(true);
    try {
      const result = await api.bindPaymentWallet(address, kind);
      const next = useAuthStore.getState().user;
      if (next) {
        setUser(withWalletBinding(
          next,
          result.wallet_chain_kind || kind,
          result.wallet_address,
          Boolean(result.wallet_verified),
          result.wallets,
        ));
      }
      return result.wallet_address;
    } finally {
      setBindingWallet(false);
    }
  }, [chainKind, isAddressValid, setUser]);

  const connectAndBindWallet = useCallback(() => {
    if (isConnected && connectedAddress) {
      void bindConnectedWallet(connectedAddress, chainKind).catch((cause) => {
        const msg = cause instanceof ApiError
          ? cause.message
          : cause instanceof Error
            ? cause.message
            : "Unable to bind wallet";
        toast.fail({ title: msg });
      });
      return;
    }
    setPendingBind(true);
    connectWallet();
  }, [bindConnectedWallet, chainKind, connectWallet, connectedAddress, isConnected, toast]);

  useEffect(() => {
    if (!pendingBind) {
      bindKeyRef.current = null;
      return;
    }
    if (!isConnected || !connectedAddress) return;
    const key = `${chainKind}:${connectedAddress}`;
    if (bindKeyRef.current === key) return;
    bindKeyRef.current = key;

    void (async () => {
      try {
        await bindConnectedWallet(connectedAddress, chainKind);
      } catch (cause) {
        bindKeyRef.current = null;
        const msg = cause instanceof ApiError
          ? cause.message
          : cause instanceof Error
            ? cause.message
            : "Unable to bind wallet";
        toast.fail({ title: msg });
      } finally {
        setPendingBind(false);
      }
    })();
    // toast.fail is stable enough for error UI; omitting it avoids effect churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBind, isConnected, connectedAddress, bindConnectedWallet, chainKind]);

  useEffect(() => {
    if (isModalOpen) {
      modalWasOpen.current = true;
      return;
    }
    if (!pendingBind || !modalWasOpen.current) {
      modalWasOpen.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      if (!connectedRef.current && !connectingRef.current) {
        setPendingBind(false);
      }
      modalWasOpen.current = false;
    }, 500);
    return () => window.clearTimeout(timer);
  }, [isModalOpen, pendingBind]);

  const ensureWalletReady = useCallback(async (): Promise<boolean> => {
    if (!isConnected || !connectedAddress) {
      setPendingBind(true);
      connectWallet();
      return false;
    }
    const current = useAuthStore.getState().user;
    const existing = bindingForKind(current, chainKind);
    if (!existing || !sameAddress(existing.address, connectedAddress, chainKind)) {
      try {
        await bindConnectedWallet(connectedAddress, chainKind);
      } catch (cause) {
        const msg = cause instanceof ApiError
          ? cause.message
          : cause instanceof Error
            ? cause.message
            : "Unable to bind wallet";
        toast.fail({ title: msg });
        return false;
      }
    }
    const paymentWallet = bindingForKind(useAuthStore.getState().user, chainKind)?.address;
    if (!paymentWallet || !sameAddress(paymentWallet, connectedAddress, chainKind)) {
      toast.fail({ title: QUICK_PAY_TOAST.SWITCH_BOUND_WALLET });
      return false;
    }
    return true;
  }, [bindConnectedWallet, chainKind, connectWallet, connectedAddress, isConnected, toast]);

  const unbindAndDisconnect = useCallback(async () => {
    try {
      const result = await api.unbindWallet(chainKind);
      wallet.disconnect();
      const current = useAuthStore.getState().user;
      if (current) {
        setUser(withoutWalletBinding(current, chainKind, result.wallets));
      }
    } catch (cause) {
      const msg = cause instanceof ApiError
        ? cause.message
        : cause instanceof Error
          ? cause.message
          : "Unable to remove wallet binding";
      toast.fail({ title: msg });
    }
  }, [chainKind, setUser, toast, wallet]);

  return {
    wallet,
    walletInfo,
    boundAddress,
    boundKind,
    pendingBind,
    bindingWallet,
    bindConnectedWallet,
    connectAndBindWallet,
    ensureWalletReady,
    unbindAndDisconnect,
  };
}
