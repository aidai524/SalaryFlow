import { useCallback, useEffect, useState } from "react";
import { sameEthereumAddress } from "@/components/quick-pay/utils";
import { QUICK_PAY_TOAST } from "@/components/quick-pay/config";
import { useEvmWalletInfo } from "@/hooks/use-evm-wallet-info";
import useToast from "@/hooks/use-toast";
import { api, ApiError } from "@/lib/api";
import { isValidEthereumAddress } from "@/lib/erc191";
import { useAuthStore } from "@/stores/auth";
import { useWallet } from "@/wallet";

export function usePaymentWallet() {
  const wallet = useWallet("evm");
  const walletInfo = useEvmWalletInfo();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const boundAddress = user?.wallet_address || null;
  const [pendingBind, setPendingBind] = useState(false);
  const [bindingWallet, setBindingWallet] = useState(false);

  const bindConnectedWallet = useCallback(async (address: string) => {
    if (!isValidEthereumAddress(address)) {
      throw new Error("Connected wallet is not a valid EVM address");
    }
    setBindingWallet(true);
    try {
      const result = await api.bindPaymentWallet(address);
      const current = useAuthStore.getState().user;
      if (current) {
        setUser({
          ...current,
          wallet_address: result.wallet_address,
          wallet_verified: false,
        });
      }
      return result.wallet_address;
    } finally {
      setBindingWallet(false);
    }
  }, [setUser]);

  const connectAndBindWallet = useCallback(() => {
    if (wallet.isConnected && wallet.account?.address) {
      void bindConnectedWallet(wallet.account.address).catch((cause) => {
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
    wallet.connect();
  }, [bindConnectedWallet, toast, wallet]);

  useEffect(() => {
    if (!pendingBind) return;
    const address = wallet.account?.address;
    if (!wallet.isConnected || !address) return;

    let cancelled = false;
    void (async () => {
      try {
        await bindConnectedWallet(address);
      } catch (cause) {
        if (cancelled) return;
        const msg = cause instanceof ApiError
          ? cause.message
          : cause instanceof Error
            ? cause.message
            : "Unable to bind wallet";
        toast.fail({ title: msg });
      } finally {
        if (!cancelled) setPendingBind(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pendingBind, wallet.isConnected, wallet.account?.address, bindConnectedWallet, toast]);

  const ensureWalletReady = useCallback(async (): Promise<boolean> => {
    if (!wallet.isConnected || !wallet.account?.address) {
      setPendingBind(true);
      wallet.connect();
      return false;
    }
    if (!useAuthStore.getState().user?.wallet_address) {
      try {
        await bindConnectedWallet(wallet.account.address);
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
    const paymentWallet = useAuthStore.getState().user?.wallet_address;
    if (!paymentWallet || !sameEthereumAddress(paymentWallet, wallet.account.address)) {
      toast.fail({ title: QUICK_PAY_TOAST.SWITCH_BOUND_WALLET });
      return false;
    }
    return true;
  }, [bindConnectedWallet, toast, wallet]);

  return {
    wallet,
    walletInfo,
    boundAddress,
    pendingBind,
    bindingWallet,
    bindConnectedWallet,
    connectAndBindWallet,
    ensureWalletReady,
  };
}
