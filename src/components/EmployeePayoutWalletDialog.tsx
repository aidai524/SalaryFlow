import { useEffect, useState } from "react";
import { AlertCircle, ShieldCheck, WalletCards } from "lucide-react";
import { PayoutOwnershipActions } from "@/components/PayoutOwnershipActions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/WorkspaceUI";
import { usePayoutOwnership } from "@/hooks/use-payout-ownership";
import { api, ApiError, type Employee } from "@/lib/api";
import { notifyPayoutUpdated } from "@/lib/payout-events";
import { preventRainbowKitDialogDismiss } from "@/lib/rainbowkit-overlay";

export function EmployeePayoutWalletDialog({
  onClose,
  onBound,
}: {
  onClose: () => void;
  onBound: (address: string) => void;
}) {
  const [payout, setPayout] = useState<Employee | null>(null);
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
        className="sm:max-w-xl"
        onPointerDownOutside={preventRainbowKitDialogDismiss}
        onInteractOutside={preventRainbowKitDialogDismiss}
        onFocusOutside={preventRainbowKitDialogDismiss}
      >
        <DialogHeader className="pr-8">
          <span className="mb-1 grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <WalletCards className="size-5" />
          </span>
          <DialogTitle className="text-lg">Payout wallet</DialogTitle>
          <DialogDescription className="leading-6">
            Verify the EVM wallet that receives your pay. Ownership is proven by a one-time message that cannot move funds.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading payout method…</p>
        ) : loadError ? (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Unable to load payout method</AlertTitle>
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
            <DialogFooter>
              <Button type="button" onClick={onClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : !payout ? (
          <div className="space-y-4">
            <Alert>
              <AlertCircle />
              <AlertTitle>Payout method not set up</AlertTitle>
              <AlertDescription>
                Choose your stablecoin and network on the Payout method page before verifying a wallet here.
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button type="button" onClick={onClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Verify wallet ownership</span>
                <StatusBadge
                  status={ownership.ownershipVerified ? "ready" : "update_required"}
                  label={ownership.ownershipVerified ? "Ready" : "Needs verification"}
                />
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
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

            {ownership.notice && (
              <Alert>
                <ShieldCheck />
                <AlertTitle>Payout wallet</AlertTitle>
                <AlertDescription>{ownership.notice}</AlertDescription>
              </Alert>
            )}
            {ownership.error && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>Wallet verification failed</AlertTitle>
                <AlertDescription>{ownership.error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button variant="outline" type="button" onClick={onClose}>Close</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
