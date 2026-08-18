import { useMemo, useState } from "react";
import { IconCheck } from "@/components/icons/check";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { sameAddress } from "@/lib/address-validation";
import { bindingForKind, withWalletBinding, withoutWalletBinding } from "@/lib/admin-wallets";
import { formatAddress } from "@/lib/address";
import { api, ApiError, type AuthUser } from "@/lib/api";
import { preventRainbowKitDialogDismiss } from "@/lib/rainbowkit-overlay";
import { cn } from "@/lib/utils";
import { useWallet, type ChainKind } from "@/wallet";

const CHAIN_OPTIONS: Array<{ kind: ChainKind; label: string }> = [
  { kind: "evm", label: "EVM" },
  { kind: "near", label: "Near" },
  { kind: "solana", label: "Solana" },
];

function chainLabel(kind: ChainKind | null | undefined): string {
  if (kind === "near") return "Near";
  if (kind === "solana") return "Solana";
  return "EVM";
}

export function WalletConnectDialog({
  user,
  onClose,
  onBound,
  onUnbound,
  title = "Payment wallet",
  description = "Bind one wallet per chain. EVM, Near, and Solana can all stay connected at the same time. Verification is optional and proven by a one-time message that cannot initiate a transaction.",
}: {
  user: AuthUser;
  onClose: () => void;
  onBound: (update: {
    wallet_address: string;
    wallet_verified: boolean;
    wallet_chain_kind: ChainKind;
    wallets: NonNullable<AuthUser["wallets"]>;
  }) => void;
  onUnbound: (update: {
    wallet_address: string | null;
    wallet_verified: boolean;
    wallet_chain_kind: ChainKind | null;
    wallets: NonNullable<AuthUser["wallets"]>;
  }) => void;
  title?: string;
  description?: string;
}) {
  const [selectedKind, setSelectedKind] = useState<ChainKind>(user.wallet_chain_kind || "evm");
  const wallet = useWallet(selectedKind);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const address = wallet.account?.address || null;
  const bound = bindingForKind(user, selectedKind);
  const boundAddress = bound?.address || null;
  const isVerified = Boolean(bound?.verified);
  const connectedMatchesBound = Boolean(
    boundAddress && address && sameAddress(boundAddress, address, selectedKind),
  );

  const kindHint = useMemo(() => {
    if (selectedKind === "near") return "Connect a NEAR wallet such as MyNearWallet or Meteor.";
    if (selectedKind === "solana") return "Connect Phantom or Solflare.";
    return "Connect an EVM wallet such as MetaMask or Rabby.";
  }, [selectedKind]);

  const bind = async () => {
    if (!address || !wallet.isAddressValid(address)) return;
    setError("");
    setBusy(true);
    try {
      const result = await api.bindPaymentWallet(address, selectedKind);
      const next = withWalletBinding(
        user,
        result.wallet_chain_kind || selectedKind,
        result.wallet_address,
        Boolean(result.wallet_verified),
        result.wallets,
      );
      onBound({
        wallet_address: next.wallet_address!,
        wallet_verified: next.wallet_verified,
        wallet_chain_kind: next.wallet_chain_kind || selectedKind,
        wallets: next.wallets || {},
      });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : cause instanceof Error ? cause.message : "Unable to bind wallet");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!address || !wallet.isAddressValid(address)) return;
    setError("");
    setBusy(true);
    try {
      const challenge = await api.createPaymentWalletChallenge(address, selectedKind);
      const signed = await wallet.signMessage({
        message: challenge.message,
        nonce: challenge.nonce || undefined,
        recipient: challenge.recipient || undefined,
      });
      const result = await api.verifyPaymentWallet({
        challengeId: challenge.challengeId,
        signature: signed.signature,
        publicKey: signed.publicKey,
        accountId: signed.address,
      });
      const next = withWalletBinding(
        user,
        result.wallet_chain_kind || selectedKind,
        result.wallet_address,
        true,
        result.wallets,
      );
      onBound({
        wallet_address: next.wallet_address!,
        wallet_verified: true,
        wallet_chain_kind: next.wallet_chain_kind || selectedKind,
        wallets: next.wallets || {},
      });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : cause instanceof Error ? cause.message : "Wallet verification failed");
    } finally {
      setBusy(false);
    }
  };

  const removeBinding = async () => {
    setError("");
    try {
      const result = await api.unbindWallet(selectedKind);
      wallet.disconnect();
      const next = withoutWalletBinding(user, selectedKind, result.wallets);
      onUnbound({
        wallet_address: result.wallet_address ?? next.wallet_address,
        wallet_verified: result.wallet_verified ?? next.wallet_verified,
        wallet_chain_kind: result.wallet_chain_kind ?? next.wallet_chain_kind,
        wallets: result.wallets ?? next.wallets ?? {},
      });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to remove wallet binding");
    }
  };

  const connectOrSwitch = () => {
    setError("");
    wallet.connect();
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
          <div className="flex gap-2">
            {CHAIN_OPTIONS.map((option) => {
              const saved = Boolean(bindingForKind(user, option.kind));
              return (
                <button
                  key={option.kind}
                  type="button"
                  onClick={() => {
                    setSelectedKind(option.kind);
                    setError("");
                  }}
                  className={cn(
                    "inline-flex h-9 flex-1 items-center justify-center rounded-[16px] border font-montserrat text-[13px] font-medium",
                    selectedKind === option.kind
                      ? "border-black bg-black text-white"
                      : "border-black/15 bg-white text-black hover:bg-black/5",
                  )}
                >
                  {option.label}
                  {saved ? <span className="ml-1 size-1.5 rounded-full bg-current opacity-70" /> : null}
                </button>
              );
            })}
          </div>

          {boundAddress ? (
            <>
              <div className="rounded-[16px] border border-black/10 bg-[#f6f6f6] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-montserrat text-[14px] font-medium text-black">
                    Bound {chainLabel(selectedKind)} wallet
                  </span>
                  {isVerified ? (
                    <span className="inline-flex h-6 items-center gap-1 rounded-[12px] bg-[#0ed000]/10 px-2 font-montserrat text-[12px] text-[#0cb400]">
                      <IconCheck className="size-2" />
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex h-6 items-center rounded-[12px] bg-[#aaa]/10 px-2 font-montserrat text-[12px] text-[#aaa]">
                      Unverified
                    </span>
                  )}
                </div>
                <p className="mt-3 break-all font-montserrat text-[14px] text-black">
                  {boundAddress}
                </p>
                <p className="mt-2 font-montserrat text-[12px] leading-5 text-[#606060]">
                  This address is used when you pay from {chainLabel(selectedKind)}.
                </p>
              </div>
              {error ? (
                <p className="font-montserrat text-[12px] text-red-600">{error}</p>
              ) : null}
              {!isVerified && !connectedMatchesBound ? (
                <p className="font-montserrat text-[12px] leading-5 text-[#606060]">
                  Connect the bound {chainLabel(selectedKind)} wallet to verify ownership.
                </p>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={removeBinding}
                  className="inline-flex h-12 flex-1 items-center justify-center rounded-[24px] border border-black/15 bg-white font-montserrat text-[15px] font-medium text-black transition-colors hover:bg-black/5"
                >
                  Use a different wallet
                </button>
                {!isVerified && connectedMatchesBound ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={verify}
                    className="inline-flex h-12 flex-1 items-center justify-center rounded-[24px] bg-black font-montserrat text-[15px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {busy ? "Waiting…" : "Verify ownership"}
                  </button>
                ) : !isVerified ? (
                  <button
                    type="button"
                    onClick={connectOrSwitch}
                    className="inline-flex h-12 flex-1 items-center justify-center rounded-[24px] bg-black font-montserrat text-[15px] font-medium text-white transition-opacity hover:opacity-90"
                  >
                    {wallet.isConnected ? "Switch wallet" : "Connect to verify"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex h-12 flex-1 items-center justify-center rounded-[24px] bg-black font-montserrat text-[15px] font-medium text-white transition-opacity hover:opacity-90"
                  >
                    Done
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={connectOrSwitch}
                className="inline-flex h-12 w-full items-center justify-center rounded-[24px] border border-black/15 bg-white font-montserrat text-[15px] font-medium text-black transition-colors hover:bg-black/5"
              >
                {wallet.isConnecting ? "Connecting…" : wallet.isConnected ? "Switch wallet" : "Connect wallet"}
              </button>
              <p className="font-montserrat text-[12px] leading-5 text-[#606060]">{kindHint}</p>

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
                Save binds this {chainLabel(selectedKind)} address for payments. Verify ownership is optional.
              </p>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={!address || busy}
                  onClick={bind}
                  className="inline-flex h-12 flex-1 items-center justify-center rounded-[24px] border border-black/15 bg-white font-montserrat text-[15px] font-medium text-black transition-colors hover:bg-black/5 disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  disabled={!address || busy}
                  onClick={verify}
                  className="inline-flex h-12 flex-1 items-center justify-center rounded-[24px] bg-black font-montserrat text-[15px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? "Waiting…" : "Verify ownership"}
                </button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
