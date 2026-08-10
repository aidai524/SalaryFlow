import { useEffect, useRef, useState, type ReactNode } from "react";
import { IdentityAvatar } from "@/components/IdentityAvatar";
import { IconAlert } from "@/components/icons/alert";
import { IconCheck } from "@/components/icons/check";
import { getChainByNetwork } from "@/config/chains";
import { useEmployeePaymentsInfiniteQuery } from "@/hooks/use-recipients-api";
import type { Employee } from "@/lib/api";
import { formatAddress, formatDate, formatTokenMinor } from "@/lib/format";
import { tokenLogoUrl } from "@/lib/logo";
import { cn } from "@/lib/utils";
import {
  formatCompensation,
  isVerified,
  roleBadgeAbbrev,
  roleBadgeColor,
  scheduleLabel,
  typeLabel,
} from "../utils";

type DetailTab = "details" | "history";

const historyDateTimeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: false,
});

function formatHistoryDateTime(value: string): string {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value;
  return historyDateTimeFmt.format(d);
}

export interface RecipientDetailCardProps {
  employee: Employee;
  onEdit: () => void;
  onPayNow: () => void;
  className?: string;
}

export function RecipientDetailCard({
  employee,
  onEdit,
  onPayNow,
  className,
}: RecipientDetailCardProps) {
  const [tab, setTab] = useState<DetailTab>("details");
  const verified = isVerified(employee);
  const chain = getChainByNetwork(employee.network);
  const scrollRef = useRef<HTMLDivElement>(null);

  const paymentsQuery = useEmployeePaymentsInfiniteQuery(
    tab === "history" ? employee.id : null,
  );
  const payments = paymentsQuery.data?.pages.flatMap((p) => p.payments) ?? [];
  const { hasNextPage, isFetchingNextPage, fetchNextPage, isLoading: paymentsLoading } =
    paymentsQuery;

  useEffect(() => {
    setTab("details");
  }, [employee.id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || tab !== "history") return;
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 48) {
        if (hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      }
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [tab, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <aside
      className={cn(
        "flex h-full min-h-[420px] w-full max-w-[371px] flex-col overflow-hidden rounded-[20px] border border-white bg-[#fdfdfd] shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)]",
        className,
      )}
    >
      {/* Header: avatar left, name/badges, verified pill top-right */}
      <div className="flex items-start gap-3 px-5 pt-5 pb-4">
        <IdentityAvatar
          seed={employee.name || employee.email || employee.id}
          size={60}
          alt=""
        />
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-montserrat text-[16px] font-medium text-black">
              {employee.name}
            </h3>
            {verified ? (
              <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-[12px] bg-[#0ed000]/10 p-[6px_10px_6px_6px] font-montserrat text-[12px] text-[#0cb400]">
                <span className="size-3 rounded-full bg-[#0ED000] shrink-0 flex justify-center items-center">
                  <IconCheck className="size-1.5 text-[#fff]" />
                </span>
                Verified
              </span>
            ) : (
              <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-[12px] bg-[#aaa]/10 px-2 font-montserrat text-[12px] text-[#aaa]">
                <span className="size-3 rounded-full bg-[#AAA] shrink-0 flex justify-center items-center">
                  <IconAlert className="size-1.5 text-[#fff]" />
                </span>
                Unverified
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {employee.role_title ? (
              <span
                className={cn(
                  "inline-flex h-6 items-center rounded-[12px] px-2.5 font-montserrat text-[12px]",
                  roleBadgeColor(employee.role_title),
                )}
              >
                {roleBadgeAbbrev(employee.role_title)}
              </span>
            ) : null}
            <span className="inline-flex h-6 items-center rounded-[12px] border border-black/10 px-2.5 font-montserrat text-[12px] text-[#909090]">
              {typeLabel(employee.employee_type)}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs: text + underline */}
      <div className="relative flex gap-6 border-b border-black/10 px-5">
        {(["details", "history"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={cn(
              "relative pb-3 font-montserrat text-[16px] font-medium capitalize transition-colors",
              tab === item ? "text-[#606060]" : "text-[#606060]/70",
            )}
          >
            {item === "details" ? "Details" : "History"}
            {tab === item ? (
              <span className="absolute right-0 bottom-0 left-0 h-[3px] rounded-full bg-black" />
            ) : null}
          </button>
        ))}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {tab === "details" ? (
          <dl className="space-y-[30px]">
            <DetailRow
              label="Compensation"
              value={
                employee.amount_minor > 0 ? formatCompensation(employee) : "—"
              }
            />
            <DetailRow
              label="Payment Schedule"
              value={scheduleLabel(employee.payment_cadence)}
            />
            <DetailRow
              label="Payout Preference"
              value={
                employee.token ? (
                  <span className="inline-flex items-center gap-1.5">
                    <img
                      src={tokenLogoUrl(employee.token)}
                      alt=""
                      className="size-4 rounded-full object-cover"
                    />
                    <span>
                      {employee.token} · {chain?.chainName || employee.network || "—"}
                    </span>
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <DetailRow
              label="Destination Wallet"
              value={
                employee.endpoint ? (
                  <span className="flex flex-col items-end gap-1">
                    <span>{formatAddress(employee.endpoint, 5, 5)}</span>
                    {verified ? (
                      <span className="inline-flex items-center gap-1 font-montserrat text-[12px] font-normal text-[#0cb400]">
                        Verified by wallet
                      </span>
                    ) : null}
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <DetailRow
              label="Next Payment"
              value={
                employee.nextPaydayDisplay
                || (employee.nextPayday ? formatDate(employee.nextPayday) : "—")
              }
            />
          </dl>
        ) : (
          <ul className="space-y-0">
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 py-3.5 font-montserrat text-[14px] font-medium text-[#606060]"
              >
                <span className="min-w-0 flex-1 truncate">
                  {p.paid_at ? formatHistoryDateTime(p.paid_at) : p.period_key}
                </span>
                <span className="shrink-0">
                  {formatTokenMinor(p.amount_minor, { maximumFractionDigits: 0 })} {p.token}
                </span>
                {p.explorerUrl || p.txHash ? (
                  <a
                    href={p.explorerUrl || `https://nearblocks.io/txns/${p.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-[#4da0ff] underline underline-offset-2 hover:opacity-80"
                  >
                    Tx
                  </a>
                ) : (
                  <span className="w-5 shrink-0" />
                )}
              </li>
            ))}
            {paymentsLoading ? (
              <li className="py-8 text-center font-montserrat text-[13px] text-[#909090]">
                Loading…
              </li>
            ) : null}
            {!paymentsLoading && payments.length === 0 ? (
              <li className="py-8 text-center font-montserrat text-[13px] text-[#909090]">
                No payment history
              </li>
            ) : null}
            {isFetchingNextPage ? (
              <li className="py-2 text-center font-montserrat text-[12px] text-[#909090]">
                Loading more…
              </li>
            ) : null}
          </ul>
        )}
      </div>

      <div className="flex gap-3 border-t border-black/10 px-5 py-4">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex h-[42px] w-[105px] shrink-0 items-center justify-center rounded-[12px] border border-black/20 bg-white font-montserrat text-[14px] font-medium text-black shadow-[0px_0px_6px_0px_rgba(0,0,0,0.06)] transition-colors hover:bg-black/5"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onPayNow}
          className="inline-flex h-[42px] min-w-0 flex-1 items-center justify-center rounded-[12px] bg-black font-montserrat text-[14px] font-medium text-white shadow-[0px_0px_6px_0px_rgba(0,0,0,0.06)] transition-opacity hover:opacity-90"
        >
          Pay Now
        </button>
      </div>
    </aside>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 font-montserrat text-[14px] font-medium text-[#606060]">{label}</dt>
      <dd className="text-right font-montserrat text-[14px] font-medium text-black">{value}</dd>
    </div>
  );
}
