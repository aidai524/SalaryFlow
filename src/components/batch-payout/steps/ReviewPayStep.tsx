import { useState } from "react";
import { TokenChainIcon } from "../TokenChainIcon";
import { EstCostRow } from "@/components/you-pay/EstCostRow";
import { YouPaySection } from "@/components/you-pay/YouPaySection";
import { formatNumber, formatTokenMinor } from "@/lib/format";
import type { IntentsToken } from "@/stores/intents-tokens";
import { draftDestination, type BatchDraft } from "../utils";

export function ReviewPayStep({
  drafts,
  originToken,
  onOriginTokenChange,
  boundAddress,
  walletConnected,
  walletIcon,
  connecting,
  onConnectWallet,
  onUseDifferentWallet,
  allowedBlockchains,
  amountInDisplay,
  feeUsd,
  timeEstimate,
  quoteError,
}: {
  drafts: BatchDraft[];
  originToken: IntentsToken | null;
  onOriginTokenChange: (token: IntentsToken) => void;
  boundAddress: string | null;
  walletConnected: boolean;
  walletIcon?: string | null;
  connecting: boolean;
  onConnectWallet: () => void;
  onUseDifferentWallet?: () => void;
  allowedBlockchains: string[];
  amountInDisplay: string;
  feeUsd?: string | null;
  timeEstimate?: string | null;
  quoteError?: string | null;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const totalOutMinor = drafts.reduce((sum, row) => {
    const n = Number(row.amount);
    return sum + (Number.isFinite(n) ? Math.round(n * 1e6) : 0);
  }, 0);

  return (
    <div>
      <YouPaySection
        amountDisplay={amountInDisplay}
        originToken={originToken}
        onOriginTokenChange={onOriginTokenChange}
        boundAddress={boundAddress}
        walletConnected={walletConnected}
        walletIcon={walletIcon}
        connecting={connecting}
        onConnectWallet={onConnectWallet}
        onUseDifferentWallet={onUseDifferentWallet}
        allowedBlockchains={allowedBlockchains}
      />

      <div className="mb-4 border-b border-black/10" />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-montserrat text-[14px] font-medium text-[#606060]">Recipients receive</p>
        <p className="font-montserrat text-[16px] font-medium text-black">
          {formatTokenMinor(totalOutMinor, { maximumFractionDigits: 6 })}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setDetailsOpen((v) => !v)}
        className="mb-3 font-montserrat text-[12px] text-black underline-offset-2 hover:underline"
      >
        {detailsOpen ? "Hide details" : "Show details"}
      </button>
      {detailsOpen ? (
        <ul className="mb-4 flex flex-col gap-2">
          {drafts.map((row) => {
            const dest = draftDestination(row);
            return (
              <li key={row.employee.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-montserrat text-[13px] text-black">{row.employee.name}</p>
                  {row.memo.trim() ? (
                    <p className="truncate font-montserrat text-[12px] text-[#909090]">{row.memo}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-montserrat text-[13px] text-black">
                    {formatNumber(Number(row.amount), { maximumFractionDigits: 6 })}
                  </span>
                  <TokenChainIcon token={dest.symbol} network={dest.network} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <EstCostRow
        amountInDisplay={amountInDisplay}
        originSymbol={originToken?.symbol}
        feeUsd={feeUsd}
        timeEstimate={timeEstimate}
      />
      {quoteError ? (
        <p className="mb-3 font-montserrat text-[13px] text-red-600">{quoteError}</p>
      ) : null}
    </div>
  );
}
