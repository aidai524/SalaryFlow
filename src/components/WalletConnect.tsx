import { useState } from "react";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { AlertCircle, ShieldCheck, WalletCards } from "lucide-react";
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
  title = "Account wallet",
  description = "Bind one EVM wallet to this email account. Ownership is proven by a one-time message that cannot initiate a transaction.",
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
        className="sm:max-w-lg"
        onPointerDownOutside={preventRainbowKitDialogDismiss}
        onInteractOutside={preventRainbowKitDialogDismiss}
        onFocusOutside={preventRainbowKitDialogDismiss}
      >
        <DialogHeader className="pr-8">
          <span className="mb-1 grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <WalletCards className="size-5" />
          </span>
          <DialogTitle className="text-lg">{title}</DialogTitle>
          <DialogDescription className="leading-6">{description}</DialogDescription>
        </DialogHeader>

        {boundAddress ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Verified wallet</span>
                <StatusBadge status="ready" label="Ownership verified" />
              </div>
              <p className="mono-value mt-4 break-all text-sm">{boundAddress}</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                This address is the only wallet currently linked to this account.
              </p>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>Wallet update failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button variant="outline" type="button" onClick={removeBinding}>Use a different wallet</Button>
              <Button type="button" onClick={onClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" className="flex-1" onClick={connectOrSwitch}>
                <WalletCards data-icon="inline-start" />
                {isConnected ? "Switch wallet" : "Connect wallet"}
              </Button>
            </div>

            {address && (
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Connected address</p>
                <p className="mono-value mt-1 break-all text-sm">{address}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatAddress(address)}</p>
              </div>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>Wallet verification failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Alert>
              <ShieldCheck />
              <AlertTitle>Ownership signature only</AlertTitle>
              <AlertDescription>The one-time message cannot transfer funds or authorize a payroll payment.</AlertDescription>
            </Alert>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
              <Button type="button" disabled={!address || verifying} onClick={bind}>
                <ShieldCheck data-icon="inline-start" />
                {verifying ? "Waiting for signature…" : "Verify ownership"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
