import { useEffect, useState } from "react";
import { PayoutOwnershipActions } from "@/components/PayoutOwnershipActions";
import { IconCheck } from "@/components/icons/check";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePayoutOwnership } from "@/hooks/use-payout-ownership";
import { api, ApiError, type MyPayout } from "@/lib/api";
import { notifyPayoutUpdated } from "@/lib/payout-events";
import { preventRainbowKitDialogDismiss } from "@/lib/rainbowkit-overlay";
import { cn } from "@/lib/utils";

export function EmployeePayoutWalletDialog({
  onClose,
  onBound,
}: {
  onClose: () => void;
  onBound: (address: string) => void;
}) {
  const [payout, setPayout] = useState<MyPayout | null>(null);
  const [endpoint, setEndpoint] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const data = await api.myPayout();
        if (cancelled) return;
        setPayout(data.payout);
        setEndpoint(data.payout?.endpoint || "");
      } catch (cause) {
        if (!cancelled) {
          setLoadError(cause instanceof ApiError ? cause.message : "Unable to load payout method");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ownership = usePayoutOwnership({
    token: payout?.token || "USDC",
    network: payout?.network || "Base",
    endpoint,
    setEndpoint,
    savedPayout: payout,
    onVerified: async (next) => {
      setPayout(next);
      notifyPayoutUpdated();
      onBound(next.endpoint);
    },
  });

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
            Wallet
          </DialogTitle>
          <p className="mt-1 font-montserrat text-[13px] leading-5 text-[#606060]">
            Verify the EVM wallet that receives your pay. Ownership is proven by a one-time message that cannot move funds.
          </p>
        </DialogHeader>

        <div className="px-6 pb-6">
          {loading ? (
            <p className="py-6 font-montserrat text-[14px] text-[#909090]">Loading payout method…</p>
          ) : loadError ? (
            <div className="space-y-4">
              <p className="rounded-[16px] bg-[#fff1f1] px-4 py-3 font-montserrat text-[13px] text-red-600">
                {loadError}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-12 w-full items-center justify-center rounded-[24px] bg-black font-montserrat text-[15px] font-medium text-white"
              >
                Done
              </button>
            </div>
          ) : !payout ? (
            <div className="space-y-4">
              <p className="rounded-[16px] bg-[#f6f6f6] px-4 py-3 font-montserrat text-[13px] text-[#606060]">
                Choose your stablecoin and network on Edit Profile before verifying a wallet here.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-12 w-full items-center justify-center rounded-[24px] bg-black font-montserrat text-[15px] font-medium text-white"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-[16px] border border-black/10 bg-[#f6f6f6] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-montserrat text-[14px] font-medium text-black">
                    Verify wallet ownership
                  </span>
                  <span
                    className={cn(
                      "inline-flex h-6 items-center gap-1 rounded-[12px] px-2 font-montserrat text-[12px]",
                      ownership.ownershipVerified
                        ? "bg-[#0ed000]/10 text-[#0cb400]"
                        : "bg-[#aaa]/10 text-[#aaa]",
                    )}
                  >
                    {ownership.ownershipVerified ? (
                      <>
                        <IconCheck className="size-2" />
                        Ready
                      </>
                    ) : (
                      "Needs verification"
                    )}
                  </span>
                </div>
                <p className="mt-2 font-montserrat text-[12px] leading-5 text-[#606060]">
                  {payout.token} on {payout.network}. Sign a one-time message — it cannot authorize payment.
                </p>
                <PayoutOwnershipActions
                  ownershipVerified={ownership.ownershipVerified}
                  connectedAddressMatches={ownership.connectedAddressMatches}
                  isConnected={ownership.isConnected}
                  address={ownership.address}
                  verifiedEndpoint={ownership.verifiedEndpoint}
                  verifying={ownership.verifying}
                  onConnect={ownership.connectWallet}
                  onChangeWallet={ownership.changeConnectedWallet}
                  onUseAddress={ownership.useConnectedAddress}
                  onVerify={ownership.verifyWallet}
                />
              </div>

              {ownership.notice ? (
                <p className="font-montserrat text-[12px] text-[#0cb400]">{ownership.notice}</p>
              ) : null}
              {ownership.error ? (
                <p className="font-montserrat text-[12px] text-red-600">{ownership.error}</p>
              ) : null}

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-12 w-full items-center justify-center rounded-[24px] border border-black/15 bg-white font-montserrat text-[15px] font-medium text-black transition-colors hover:bg-black/5"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
