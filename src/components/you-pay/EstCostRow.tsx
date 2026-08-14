import { IconLock } from "@/components/icons/lock";
import { PRIVATE_BY_DEFAULT_LABEL } from "@/components/quick-pay/config";

export function EstCostRow({
  amountInDisplay,
  originSymbol,
  feeUsd,
  timeEstimate,
}: {
  amountInDisplay: string;
  originSymbol?: string | null;
  feeUsd?: string | null;
  timeEstimate?: string | null;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2 font-montserrat text-[12px]">
        <span className="text-[#70788a]">Est. Cost</span>
        <span className="text-[#444c59]">
          {amountInDisplay !== "—" && originSymbol
            ? `${amountInDisplay} ${originSymbol}`
            : "—"}
        </span>
        <span className="inline-flex h-[26px] items-center gap-1.5 rounded-[13px] border border-[#d0f348] bg-[rgba(208,243,72,0.2)] px-2.5 font-montserrat text-[12px] font-medium text-[#84a20f]">
          <IconLock className="size-3" />
          {PRIVATE_BY_DEFAULT_LABEL}
        </span>
      </div>
      <div className="flex items-center gap-3 font-space-grotesk text-[12px] text-[#444c59]">
        {feeUsd != null ? (
          <span className="inline-flex items-center gap-1">
            <img src="/icons/fee.svg" alt="" className="size-3.5" />
            ${feeUsd}
          </span>
        ) : null}
        {timeEstimate ? (
          <span className="inline-flex items-center gap-1">
            <img src="/icons/duration.svg" alt="" className="size-3.5" />
            {timeEstimate}
          </span>
        ) : null}
      </div>
    </div>
  );
}
