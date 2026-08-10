import { useEffect, useMemo, useRef, useState } from "react";
import {
  eachWeekOfInterval,
  endOfISOWeek,
  endOfYear,
  format,
  getISOWeek,
  getISOWeekYear,
  parse,
  startOfISOWeek,
  startOfYear,
} from "date-fns";
import type { TeamPaymentSchedule } from "@/lib/api";
import { cn } from "@/lib/utils";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export interface PaymentPeriodPickerProps {
  cadence: TeamPaymentSchedule;
  value: string;
  onChange: (periodKey: string) => void;
  className?: string;
}

export function periodKeyFromDate(cadence: TeamPaymentSchedule, date: Date = new Date()): string {
  if (cadence === "weekly") {
    const year = getISOWeekYear(date);
    const week = getISOWeek(date);
    return `${year}-W${String(week).padStart(2, "0")}`;
  }
  return format(date, "yyyy-MM");
}

export function formatPeriodLabel(cadence: TeamPaymentSchedule, periodKey: string): string {
  if (cadence === "weekly") {
    const match = /^(\d{4})-W(\d{2})$/.exec(periodKey);
    if (!match) return periodKey;
    return `${match[1]} Week ${Number(match[2])} Payment`;
  }
  const match = /^(\d{4})-(\d{2})$/.exec(periodKey);
  if (!match) return periodKey;
  const date = parse(`${match[1]}-${match[2]}-01`, "yyyy-MM-dd", new Date());
  return `${format(date, "yyyy MMMM")} Payment`;
}

function yearFromPeriodKey(cadence: TeamPaymentSchedule, periodKey: string): number {
  if (cadence === "weekly") {
    const match = /^(\d{4})-W(\d{2})$/.exec(periodKey);
    return match ? Number(match[1]) : new Date().getFullYear();
  }
  const match = /^(\d{4})-(\d{2})$/.exec(periodKey);
  return match ? Number(match[1]) : new Date().getFullYear();
}

function monthFromPeriodKey(periodKey: string): number | null {
  const match = /^(\d{4})-(\d{2})$/.exec(periodKey);
  return match ? Number(match[2]) : null;
}

function weekFromPeriodKey(periodKey: string): number | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(periodKey);
  return match ? Number(match[2]) : null;
}

export function PaymentPeriodPicker({
  cadence,
  value,
  onChange,
  className,
}: PaymentPeriodPickerProps) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => yearFromPeriodKey(cadence, value));
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setViewYear(yearFromPeriodKey(cadence, value));
  }, [cadence, value]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const weeks = useMemo(() => {
    if (cadence !== "weekly") return [];
    const yearStart = startOfYear(new Date(viewYear, 0, 1));
    const yearEnd = endOfYear(new Date(viewYear, 0, 1));
    const starts = eachWeekOfInterval(
      { start: yearStart, end: yearEnd },
      { weekStartsOn: 1 },
    );
    return starts.map((start) => {
      const isoStart = startOfISOWeek(start);
      const year = getISOWeekYear(isoStart);
      const week = getISOWeek(isoStart);
      return {
        key: `${year}-W${String(week).padStart(2, "0")}`,
        week,
        year,
        label: `Week ${week}`,
        range: `${format(isoStart, "MMM d")} – ${format(endOfISOWeek(isoStart), "MMM d")}`,
      };
    }).filter((w) => w.year === viewYear);
  }, [cadence, viewYear]);

  const selectedMonth = monthFromPeriodKey(value);
  const selectedWeek = weekFromPeriodKey(value);
  const label = formatPeriodLabel(cadence, value);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 items-center gap-2 rounded-[20px] border border-black/10 bg-white px-4 font-montserrat text-[14px] font-medium text-black transition-colors hover:bg-black/5"
      >
        {label}
        <img
          src="/icons/to-down.svg"
          alt=""
          className={cn("size-2.5 opacity-60 transition-transform", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-40 w-[280px] rounded-[16px] border border-black/10 bg-white p-4 shadow-[0px_8px_24px_rgba(0,0,0,0.08)]">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous year"
              onClick={() => setViewYear((y) => y - 1)}
              className="inline-flex size-8 items-center justify-center rounded-full hover:bg-black/5"
            >
              <img src="/icons/to-down.svg" alt="" className="size-2.5 rotate-90 opacity-60" />
            </button>
            <span className="font-montserrat text-[14px] font-semibold text-black">{viewYear}</span>
            <button
              type="button"
              aria-label="Next year"
              onClick={() => setViewYear((y) => y + 1)}
              className="inline-flex size-8 items-center justify-center rounded-full hover:bg-black/5"
            >
              <img src="/icons/to-down.svg" alt="" className="size-2.5 -rotate-90 opacity-60" />
            </button>
          </div>

          {cadence === "monthly" ? (
            <div className="grid grid-cols-3 gap-2">
              {MONTHS.map((month, index) => {
                const monthNum = index + 1;
                const key = `${viewYear}-${String(monthNum).padStart(2, "0")}`;
                const active =
                  yearFromPeriodKey("monthly", value) === viewYear && selectedMonth === monthNum;
                return (
                  <button
                    key={month}
                    type="button"
                    onClick={() => {
                      onChange(key);
                      setOpen(false);
                    }}
                    className={cn(
                      "h-9 rounded-[10px] font-montserrat text-[13px] font-medium transition-colors",
                      active
                        ? "bg-black text-white"
                        : "text-black hover:bg-black/5",
                    )}
                  >
                    {month}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="max-h-[240px] space-y-1 overflow-y-auto pr-1">
              {weeks.map((week) => {
                const active =
                  yearFromPeriodKey("weekly", value) === viewYear && selectedWeek === week.week;
                return (
                  <button
                    key={week.key}
                    type="button"
                    onClick={() => {
                      onChange(week.key);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-[10px] px-3 py-2 font-montserrat text-[13px] transition-colors",
                      active
                        ? "bg-black text-white"
                        : "text-black hover:bg-black/5",
                    )}
                  >
                    <span className="font-medium">{week.label}</span>
                    <span className={cn("text-[11px]", active ? "text-white/70" : "text-[#909090]")}>
                      {week.range}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
