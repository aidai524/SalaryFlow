import { IconCheck } from "@/components/icons/check";
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
            <span className="min-w-0 flex-1 truncate font-montserrat text-[12px] text-[#0cb400]">
              {formatAddress(verifiedEndpoint || "")} · address verified
            </span>
            <span
              role="status"
              className="inline-flex items-center gap-1.5 font-montserrat text-[13px] font-medium text-[#0cb400]"
            >
              <IconCheck className="size-2.5" aria-hidden="true" />
              Ownership verified
            </span>
            <button
              type="button"
              onClick={onChangeWallet}
              className="font-montserrat text-[13px] text-[#606060] underline-offset-2 hover:underline"
            >
              Change wallet
            </button>
          </>
        ) : !isConnected ? (
          <button
            type="button"
            onClick={onConnect}
            className="inline-flex h-10 items-center justify-center rounded-[20px] border border-black/15 bg-white px-4 font-montserrat text-[14px] font-medium text-black shadow-[0_0_6px_rgba(0,0,0,0.06)] transition-colors hover:bg-black/5"
          >
            Connect wallet
          </button>
        ) : (
          <>
            <span
              className={`min-w-0 flex-1 truncate font-montserrat text-[12px] ${
                connectedAddressMatches ? "text-[#0cb400]" : "text-[#e89300]"
              }`}
            >
              {formatAddress(address || "")} ·{" "}
              {connectedAddressMatches ? "address matches" : "does not match"}
            </span>
            {connectedAddressMatches ? (
              <button
                type="button"
                disabled={verifying}
                onClick={onVerify}
                className="inline-flex h-10 items-center justify-center rounded-[20px] bg-black px-4 font-montserrat text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {verifying ? "Waiting…" : "Verify ownership"}
              </button>
            ) : (
              <button
                type="button"
                onClick={onUseAddress}
                className="inline-flex h-10 items-center justify-center rounded-[20px] border border-black/15 bg-white px-4 font-montserrat text-[14px] font-medium text-black transition-colors hover:bg-black/5"
              >
                Use this address
              </button>
            )}
            <button
              type="button"
              disabled={verifying}
              onClick={onChangeWallet}
              className="font-montserrat text-[13px] text-[#606060] underline-offset-2 hover:underline disabled:opacity-50"
            >
              Change wallet
            </button>
          </>
        )}
      </div>
      {isConnected && !connectedAddressMatches && (
        <p className="mt-2 font-montserrat text-[12px] leading-5 text-[#606060]">
          Use the connected address above, or connect a different wallet. Either choice requires a new ownership signature.
        </p>
      )}
    </>
  );
}
