import { useState } from "react";
import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
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
import { api, ApiError, type AuthUser } from "@/lib/api";
import { isValidEthereumAddress } from "@/lib/erc191";

export function WalletConnectDialog({
  user,
  onClose,
  onBound,
  onUnbound,
}: {
  user: AuthUser;
  onClose: () => void;
  onBound: (address: string) => void;
  onUnbound: () => void;
}) {
  const { connect, connectors } = useConnect();
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

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="pr-8">
          <span className="mb-1 grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <WalletCards className="size-5" />
          </span>
          <DialogTitle className="text-lg">Payment authorization wallet</DialogTitle>
          <DialogDescription className="leading-6">
            Bind the EVM wallet that authorizes payroll payments. Ownership is proven by a one-time message that cannot initiate a transaction.
          </DialogDescription>
        </DialogHeader>

        {boundAddress ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Verified wallet</span>
                <StatusBadge status="ready" label="Ownership verified" />
              </div>
              <p className="mono-value mt-4 break-all text-sm">{boundAddress}</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">This address is the only wallet currently authorized for this payroll account.</p>
            </div>
            {error && <Alert variant="destructive"><AlertCircle /><AlertTitle>Wallet update failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
            <DialogFooter>
              <Button variant="outline" type="button" onClick={removeBinding}>Use a different wallet</Button>
              <Button type="button" onClick={onClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted"
                  onClick={() => connect({ connector })}
                >
                  <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><WalletCards className="size-4" /></span>
                  <span>
                    <strong className="block text-sm font-medium">{connector.name}</strong>
                    <small className="text-xs text-muted-foreground">Browser wallet connector</small>
                  </span>
                </button>
              ))}
              {connectors.length === 0 && (
                <Alert><AlertCircle /><AlertTitle>No browser wallet detected</AlertTitle><AlertDescription>Install or unlock a compatible EVM wallet, then reopen this dialog.</AlertDescription></Alert>
              )}
            </div>

            {address && (
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Connected address</p>
                <p className="mono-value mt-1 break-all text-sm">{address}</p>
              </div>
            )}
            {error && <Alert variant="destructive"><AlertCircle /><AlertTitle>Wallet verification failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

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
