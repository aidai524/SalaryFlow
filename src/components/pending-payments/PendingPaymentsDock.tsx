import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { pendingStatusLabel, usePendingPaymentsQuery } from "@/hooks/use-pending-payments";
import { formatTokenMinor } from "@/lib/format";
import { cn } from "@/lib/utils";

const EXIT_MS = 280;
const VISIBLE_ROWS = 3;

export function PendingPaymentsDock() {
  const { data: payments = [] } = usePendingPaymentsQuery();
  const [expanded, setExpanded] = useState(true);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dismissedFailed, setDismissedFailed] = useState<Set<string>>(() => new Set());
  const prevCountRef = useRef(0);
  const exitTimerRef = useRef<number | null>(null);

  const rows = useMemo(
    () => payments.filter((item) => {
      if (item.state === "failed" || item.state === "refunded") {
        return !dismissedFailed.has(item.attemptId);
      }
      return true;
    }),
    [payments, dismissedFailed],
  );

  // Mount / unmount with slide animation when the list becomes empty or non-empty.
  useEffect(() => {
    if (rows.length > 0) {
      if (exitTimerRef.current) {
        window.clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      setMounted(true);
      // Next frame so the enter transition runs.
      requestAnimationFrame(() => setVisible(true));
      return;
    }
    if (!mounted) return;
    setVisible(false);
    exitTimerRef.current = window.setTimeout(() => {
      setMounted(false);
      exitTimerRef.current = null;
    }, EXIT_MS);
  }, [rows.length, mounted]);

  // Auto-expand when a new payment appears.
  useEffect(() => {
    if (rows.length > prevCountRef.current) {
      setExpanded(true);
    }
    prevCountRef.current = rows.length;
  }, [rows.length]);

  useEffect(() => () => {
    if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
  }, []);

  if (!mounted) return null;

  return (
    <aside
      className={cn(
        "fixed right-4 bottom-4 z-50 w-[min(100vw-2rem,360px)] transition-all duration-300 ease-out",
        visible ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0",
      )}
      aria-live="polite"
    >
      <div className="overflow-hidden rounded-[16px] border border-black/10 bg-white shadow-[0px_8px_28px_rgba(0,0,0,0.12)]">
        <div className="flex items-center gap-2 border-b border-black/5 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="font-montserrat text-[14px] font-medium text-black">Pending Payments</p>
            {!expanded ? (
              <p className="mt-0.5 font-montserrat text-[12px] text-[#606060]">
                {rows.length} in progress
              </p>
            ) : null}
          </div>
          {!expanded ? (
            <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-black px-1.5 py-0.5 font-space-grotesk text-[11px] text-white">
              {rows.length}
            </span>
          ) : null}
          <button
            type="button"
            aria-label={expanded ? "Collapse pending payments" : "Expand pending payments"}
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex size-8 items-center justify-center rounded-full border border-black/10 text-black transition-colors hover:bg-black/5"
          >
            <svg
              viewBox="0 0 16 16"
              className={cn("size-3.5 transition-transform duration-200", expanded ? "rotate-180" : "rotate-0")}
              aria-hidden
            >
              <path
                d="M4 6.5L8 10.5L12 6.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
            expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <ul
              className={cn(
                "divide-y divide-black/5",
                rows.length > VISIBLE_ROWS && "max-h-[216px] overflow-y-auto",
              )}
            >
              {rows.map((item) => {
                const failed = item.state === "failed" || item.state === "refunded";
                const amount = formatTokenMinor(item.amountMinor, { maximumFractionDigits: 6 });
                const when = formatDistanceToNowStrict(new Date(item.createdAt), { addSuffix: true });
                return (
                  <li key={item.attemptId} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-montserrat text-[14px] font-medium text-black">
                          {item.employeeName}
                        </p>
                        <p className="mt-0.5 font-space-grotesk text-[13px] text-[#444c59]">
                          {amount} {item.token}
                        </p>
                        <p className="mt-0.5 font-montserrat text-[11px] text-[#9fa7ba]">{when}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span
                          className={cn(
                            "font-montserrat text-[12px] font-medium",
                            failed ? "text-red-600" : "text-[#0e3616]",
                          )}
                        >
                          {pendingStatusLabel(item.state)}
                        </span>
                        {failed ? (
                          <button
                            type="button"
                            onClick={() => {
                              setDismissedFailed((prev) => {
                                const next = new Set(prev);
                                next.add(item.attemptId);
                                return next;
                              });
                            }}
                            className="font-montserrat text-[11px] text-[#606060] underline-offset-2 hover:underline"
                          >
                            Dismiss
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </aside>
  );
}
