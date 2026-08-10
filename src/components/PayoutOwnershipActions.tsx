import { CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatAddress } from "@/lib/address";

export function PayoutOwnershipActions({
  ownershipVerified,
  connectedAddressMatches,
  isConnected,
  address,
  verifiedEndpoint,
  verifying,
  onConnect,
  onChangeWallet,
  onUseAddress,
  onVerify,
}: {
  ownershipVerified: boolean;
  connectedAddressMatches: boolean;
  isConnected: boolean;
  address?: string;
  verifiedEndpoint?: string | null;
  verifying: boolean;
  onConnect: () => void;
  onChangeWallet: () => void;
  onUseAddress: () => void;
  onVerify: () => void;
}) {
  return (
    <>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        {ownershipVerified && (!isConnected || connectedAddressMatches) ? (
          <>
            <span className="mono-value min-w-0 flex-1 truncate text-xs text-emerald-700">
              {formatAddress(verifiedEndpoint)} · address verified
            </span>
            <span role="status" className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="size-4" aria-hidden="true" />Ownership verified
            </span>
            <Button variant="ghost" type="button" onClick={onChangeWallet}>Change wallet</Button>
          </>
        ) : !isConnected ? (
          <Button variant="outline" type="button" onClick={onConnect}>
            Connect wallet
          </Button>
        ) : (
          <>
            <span className={`mono-value min-w-0 flex-1 truncate text-xs ${connectedAddressMatches ? "text-emerald-700" : "text-amber-700"}`}>
              {formatAddress(address)} · {connectedAddressMatches ? "address matches" : "does not match"}
            </span>
            {connectedAddressMatches ? (
              <Button variant="outline" type="button" disabled={verifying} onClick={onVerify}>
                <ShieldCheck data-icon="inline-start" />{verifying ? "Waiting…" : "Verify ownership"}
              </Button>
            ) : (
              <Button variant="outline" type="button" onClick={onUseAddress}>Use this address</Button>
            )}
            <Button variant="ghost" type="button" disabled={verifying} onClick={onChangeWallet}>Change wallet</Button>
          </>
        )}
      </div>
      {isConnected && !connectedAddressMatches && (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Use the connected address above, or disconnect it and connect a different wallet. Either choice requires a new ownership signature.
        </p>
      )}
    </>
  );
}
