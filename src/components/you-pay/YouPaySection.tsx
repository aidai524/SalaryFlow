import { useEffect, useState } from "react";
import { TokenNetworkDialog } from "@/components/token-network-dialog/TokenNetworkDialog";
import { formatAddress, formatNumber } from "@/lib/format";
import { chainLogoUrl } from "@/lib/logo";
import type { IntentsToken } from "@/stores/intents-tokens";
import { useTokenBalance } from "@/hooks/use-token-balances";
import { useTokenBalancesStore } from "@/stores/token-balances";

export interface YouPaySectionProps {
  amountDisplay: string;
  originToken: IntentsToken | null;
  onOriginTokenChange: (token: IntentsToken) => void;
  boundAddress: string | null;
  walletConnected: boolean;
  walletIcon?: string | null;
  connecting: boolean;
  onConnectWallet: () => void;
  allowedBlockchains?: string[] | null;
}

export function YouPaySection({
  amountDisplay,
  originToken,
  onOriginTokenChange,
  boundAddress,
  walletConnected,
  walletIcon,
  connecting,
  onConnectWallet,
  allowedBlockchains = null,
}: YouPaySectionProps) {
  const [originDialogOpen, setOriginDialogOpen] = useState(false);
  const fetchOneBalance = useTokenBalancesStore((s) => s.fetchOne);
  const originBalance = useTokenBalance(boundAddress, originToken?.assetId);

  useEffect(() => {
    if (!boundAddress || !originToken?.contractAddress) return;
    void fetchOneBalance(boundAddress, originToken);
    const id = window.setInterval(() => {
      void fetchOneBalance(boundAddress, originToken);
    }, 20_000);
    return () => window.clearInterval(id);
  }, [boundAddress, originToken, fetchOneBalance]);

  return (
    <>
      <div className="mb-1 flex items-center justify-between">
        <p className="font-montserrat text-[14px] font-medium text-[#606060]">You Pay</p>
        <div className="flex items-center gap-1.5">
          {boundAddress && walletConnected && walletIcon ? (
            <img src={walletIcon} alt="" className="size-3 rounded-[2px] object-cover" />
          ) : null}
          {boundAddress ? (
            <p className="font-montserrat text-[12px] text-[#606060]">
              {formatAddress(boundAddress)}
            </p>
          ) : (
            <button
              type="button"
              onClick={onConnectWallet}
              disabled={connecting}
              className="font-montserrat text-[12px] text-black underline-offset-2 hover:underline disabled:opacity-50"
            >
              {connecting ? "Connecting…" : "Connect wallet"}
            </button>
          )}
        </div>
      </div>
      <div className="mb-1 flex min-w-0 flex-wrap items-end justify-between gap-3">
        <p className="min-w-0 break-all font-montserrat text-[16px] font-medium text-black">{amountDisplay}</p>
        <button
          type="button"
          onClick={() => setOriginDialogOpen(true)}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[18px] border border-black/10 px-3 font-montserrat text-[14px] font-medium text-black transition-colors hover:bg-black/5"
        >
          {originToken ? (
            <>
              <span className="relative size-5">
                <img src={originToken.logo} alt="" className="size-5 rounded-full object-cover" />
                <img
                  src={chainLogoUrl(originToken.blockchain)}
                  alt=""
                  className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-[2px] border border-white object-cover"
                />
              </span>
              {originToken.symbol}
            </>
          ) : (
            "Token"
          )}
          <img src="/icons/to-down.svg" alt="" className="size-2.5 opacity-60" />
        </button>
      </div>
      <p className="mb-4 font-space-grotesk text-[12px]">
        <span className="text-[#9fa7ba]">Balance: </span>
        <span className="text-[#0e3616]">
          {originBalance?.status === "loading" ? (
            <span
              className="inline-block size-3 animate-spin rounded-full border-2 border-[#0e3616] border-r-transparent align-middle"
              aria-label="Loading balance"
            />
          ) : originBalance?.status === "success" && originBalance.formatted != null ? (
            formatNumber(Number(originBalance.formatted), { maximumFractionDigits: 2 })
          ) : (
            "—"
          )}
        </span>
      </p>
      <TokenNetworkDialog
        open={originDialogOpen}
        onOpenChange={setOriginDialogOpen}
        title="You pay with"
        initialSymbol={(originToken?.symbol || "USDT") as "USDC" | "USDT"}
        selectedAssetId={originToken?.assetId}
        showBalances
        balanceOwner={boundAddress}
        allowedBlockchains={allowedBlockchains}
        onSelect={({ token }) => {
          onOriginTokenChange(token);
          if (boundAddress) {
            void fetchOneBalance(boundAddress, token);
          }
        }}
      />
    </>
  );
}
