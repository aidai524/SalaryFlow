import { useState } from "react";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { IconCheck } from "@/components/icons/check";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOpenWalletModal } from "@/hooks/use-open-wallet-modal";
import { formatAddress } from "@/lib/address";
import { api, ApiError, type AuthUser } from "@/lib/api";
import { isValidEthereumAddress } from "@/lib/erc191";
import { preventRainbowKitDialogDismiss } from "@/lib/rainbowkit-overlay";

export function WalletConnectDialog({
  user,
  onClose,
  onBound,
  onUnbound,
  title = "Payment wallet",
  description = "Bind one EVM wallet to this account. Ownership is proven by a one-time message that cannot initiate a transaction.",
}: {
  user: AuthUser;
  onClose: () => void;
  onBound: (address: string) => void;
  onUnbound: () => void;
  title?: string;
  description?: string;
}) {
  const { openWalletModal, isConnected } = useOpenWalletModal();
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  const boundAddress = user.wallet_verified ? user.wallet_address : null;

  const bind = async () => {
    if (!address || !isValidEthereumAddress(address)) return;
    setError("");
    setVerifying(true);
    try {
      const challenge = await api.createPaymentWalletChallenge(address);
      const signature = await signMessageAsync({ message: challenge.message });
      const result = await api.verifyPaymentWallet({ challengeId: challenge.challengeId, signature });
      onBound(result.wallet_address);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : cause instanceof Error ? cause.message : "Wallet verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const removeBinding = async () => {
    setError("");
    try {
      await api.unbindWallet();
      disconnect();
      onUnbound();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to remove wallet binding");
    }
  };

  const connectOrSwitch = () => {
    setError("");
    openWalletModal();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        showCloseButton
        className="max-w-[440px] gap-0 overflow-hidden rounded-[24px] p-0 sm:max-w-[440px]"
        onPointerDownOutside={preventRainbowKitDialogDismiss}
        onInteractOutside={preventRainbowKitDialogDismiss}
        onFocusOutside={preventRainbowKitDialogDismiss}
      >
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="font-montserrat text-[20px] font-semibold text-black">
            {title}
          </DialogTitle>
          <p className="mt-1 font-montserrat text-[13px] leading-5 text-[#606060]">
            {description}
          </p>
        </DialogHeader>

        <div className="space-y-4 px-6 pb-6">
          {boundAddress ? (
            <>
              <div className="rounded-[16px] border border-black/10 bg-[#f6f6f6] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-montserrat text-[14px] font-medium text-black">
                    Verified wallet
                  </span>
                  <span className="inline-flex h-6 items-center gap-1 rounded-[12px] bg-[#0ed000]/10 px-2 font-montserrat text-[12px] text-[#0cb400]">
                    <IconCheck className="size-2" />
                    Verified
                  </span>
                </div>
                <p className="mt-3 break-all font-montserrat text-[14px] text-black">
                  {boundAddress}
                </p>
                <p className="mt-2 font-montserrat text-[12px] leading-5 text-[#606060]">
                  This address is the only wallet currently linked to this account.
                </p>
              </div>
              {error ? (
                <p className="font-montserrat text-[12px] text-red-600">{error}</p>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={removeBinding}
                  className="inline-flex h-12 flex-1 items-center justify-center rounded-[24px] border border-black/15 bg-white font-montserrat text-[15px] font-medium text-black transition-colors hover:bg-black/5"
                >
                  Use a different wallet
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-12 flex-1 items-center justify-center rounded-[24px] bg-black font-montserrat text-[15px] font-medium text-white transition-opacity hover:opacity-90"
                >
                  Done
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={connectOrSwitch}
                className="inline-flex h-12 w-full items-center justify-center rounded-[24px] border border-black/15 bg-white font-montserrat text-[15px] font-medium text-black transition-colors hover:bg-black/5"
              >
                {isConnected ? "Switch wallet" : "Connect wallet"}
              </button>

              {address ? (
                <div className="rounded-[16px] border border-black/10 bg-[#f6f6f6] p-4">
                  <p className="font-montserrat text-[12px] text-[#606060]">Connected address</p>
                  <p className="mt-1 break-all font-montserrat text-[14px] text-black">{address}</p>
                  <p className="mt-1 font-montserrat text-[12px] text-[#909090]">
                    {formatAddress(address)}
                  </p>
                </div>
              ) : null}

              {error ? (
                <p className="font-montserrat text-[12px] text-red-600">{error}</p>
              ) : null}

              <p className="font-montserrat text-[12px] leading-5 text-[#606060]">
                The one-time message cannot transfer funds or authorize a payroll payment.
              </p>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-12 flex-1 items-center justify-center rounded-[24px] border border-black/15 bg-white font-montserrat text-[15px] font-medium text-black transition-colors hover:bg-black/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!address || verifying}
                  onClick={bind}
                  className="inline-flex h-12 flex-1 items-center justify-center rounded-[24px] bg-black font-montserrat text-[15px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {verifying ? "Waiting…" : "Verify ownership"}
                </button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
