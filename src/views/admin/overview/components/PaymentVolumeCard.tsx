import { useEffect, useRef, useState } from "react";
import type { TeamPaymentSchedule } from "@/lib/api";
import { cn } from "@/lib/utils";
import { VOLUME_RANGE_OPTIONS, type VolumeRange } from "../config";
import { VolumeBarChart } from "./VolumeBarChart";
import type { OrgOverview } from "@/lib/api";
import { CARD_CLASS } from "../config";

export function PaymentVolumeCard({
  cadence,
  volumeRange,
  onVolumeRangeChange,
  bars,
  isLoading,
}: {
  cadence: TeamPaymentSchedule;
  volumeRange: VolumeRange;
  onVolumeRangeChange: (range: VolumeRange) => void;
  bars: OrgOverview["volume"]["bars"] | undefined;
  isLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const active = VOLUME_RANGE_OPTIONS.find((o) => o.value === volumeRange)!;
  const activeLabel = cadence === "weekly" ? active.weeklyLabel : active.label;

  return (
    <section className={`${CARD_CLASS} p-5 sm:p-6`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-montserrat text-[20px] font-medium text-black">Payment Volume</h2>
        <div ref={rootRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-9 items-center gap-2 rounded-[18px] border border-black/10 bg-white px-3.5 font-montserrat text-[13px] font-medium text-black"
          >
            {activeLabel}
            <img
              src="/icons/to-down.svg"
              alt=""
              className={cn("size-2.5 opacity-60 transition-transform", open && "rotate-180")}
            />
          </button>
          {open ? (
            <div className="absolute right-0 top-[calc(100%+6px)] z-20 min-w-[140px] rounded-[12px] border border-black/10 bg-white p-1 shadow-lg">
              {VOLUME_RANGE_OPTIONS.map((opt) => {
                const label = cadence === "weekly" ? opt.weeklyLabel : opt.label;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onVolumeRangeChange(opt.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full rounded-[8px] px-3 py-2 text-left font-montserrat text-[13px]",
                      opt.value === volumeRange ? "bg-black text-white" : "text-black hover:bg-black/5",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
      {isLoading || !bars ? (
        <div className="flex h-[260px] items-center justify-center font-montserrat text-[14px] text-[#909090]">
          Loading…
        </div>
      ) : bars.length === 0 ? (
        <div className="flex h-[260px] items-center justify-center font-montserrat text-[14px] text-[#909090]">
          No payment volume yet
        </div>
      ) : (
        <VolumeBarChart bars={bars} />
      )}
    </section>
  );
}
