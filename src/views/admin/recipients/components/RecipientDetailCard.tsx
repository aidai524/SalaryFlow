import { useEffect, useRef, useState, type ReactNode } from "react";
import { IdentityAvatar, identityAvatarSeed } from "@/components/IdentityAvatar";
import { IconAlert } from "@/components/icons/alert";
import { IconCalendar } from "@/components/icons/calendar";
import { IconCash } from "@/components/icons/cash";
import { IconCheck } from "@/components/icons/check";
import { IconDatabase } from "@/components/icons/database";
import { IconLock } from "@/components/icons/lock";
import { IconMeno } from "@/components/icons/meno";
import { IconMoney } from "@/components/icons/money";
import { IconWallet } from "@/components/icons/wallet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getChainByNetwork } from "@/config/chains";
import { useEmployeePaymentsInfiniteQuery } from "@/hooks/use-recipients-api";
import type { Employee } from "@/lib/api";
import { formatAddress, formatDate, formatTokenMinor } from "@/lib/format";
import { tokenLogoUrl } from "@/lib/logo";
import { cn } from "@/lib/utils";
import {
  HISTORY_STATUS,
  mapPaymentStatus,
} from "@/views/admin/payment-history/config";
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

function hasDisplayValue(value: ReactNode): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim() !== "" && value !== "—";
  return true;
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
  const [copied, setCopied] = useState(false);
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
    setCopied(false);
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

  const compensationValue =
    employee.amount_minor > 0 ? formatCompensation(employee) : null;
  const scheduleValue = scheduleLabel(employee.payment_cadence);
  const payoutValue = employee.token ? (
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
  ) : null;
  const nextPaymentValue =
    employee.nextPaydayDisplay
    || (employee.nextPayday ? formatDate(employee.nextPayday) : null);

  const copyWallet = async () => {
    if (!employee.endpoint) return;
    try {
      await navigator.clipboard.writeText(employee.endpoint);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <aside
      className={cn(
        "flex h-full min-h-[420px] w-full max-w-[371px] flex-col overflow-hidden rounded-[20px] border border-white bg-[#fdfdfd] shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)]",
        className,
      )}
    >
      <div className="flex items-start gap-3 px-5 pt-5 pb-4">
        <IdentityAvatar
          seed={identityAvatarSeed(employee)}
          src={employee.avatar_url}
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
              icon={<IconCash className="size-3.5" />}
              value={compensationValue || "—"}
              filled={!!compensationValue}
            />
            <DetailRow
              label="Payment Schedule"
              icon={<IconCalendar className="size-3.5" />}
              value={scheduleValue || "—"}
              filled={hasDisplayValue(scheduleValue)}
            />
            <DetailRow
              label="Payout Preference"
              icon={<IconDatabase className="size-3.5" />}
              value={payoutValue || "—"}
              filled={!!payoutValue}
            />
            <DetailRow
              label="Destination Wallet"
              icon={<IconWallet className="size-3.5" />}
              filled={!!employee.endpoint}
              value={
                employee.endpoint ? (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <span>{formatAddress(employee.endpoint, 5, 5)}</span>
                      <Tooltip open={copied}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => void copyWallet()}
                            aria-label="Copy wallet address"
                            className="inline-flex size-4 items-center justify-center opacity-60 transition-opacity hover:opacity-100"
                          >
                            <img src="/icons/copy.svg" alt="" className="size-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="flex items-center gap-1.5">
                          <span className="inline-flex size-5 items-center justify-center rounded-full bg-[#0ed000] text-white">
                            <IconCheck className="size-2.5" />
                          </span>
                          Copied!
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    {verified ? (
                      <span className="font-montserrat text-[12px] font-normal text-[#0cb400]">
                        Verified by wallet
                      </span>
                    ) : null}
                  </div>
                ) : (
                  "—"
                )
              }
            />
            <DetailRow
              label="Private Payment"
              icon={<IconLock className="size-3.5" />}
              filled
              value={
                <div className="flex flex-col gap-0.5">
                  <span>Enabled</span>
                  <span className="font-montserrat text-[12px] font-normal text-[#aaa]">
                    Payments are confidential by default
                  </span>
                </div>
              }
            />
            <DetailRow
              label="Next Payment"
              icon={<IconMoney className="size-3.5" />}
              value={nextPaymentValue || "—"}
              filled={!!nextPaymentValue}
            />
          </dl>
        ) : (
          <ul className="space-y-0">
            {payments.map((p) => {
              const statusKey = mapPaymentStatus(p.status || "pending");
              const statusMeta = HISTORY_STATUS[statusKey];
              const memoText = p.memo?.trim();
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-3 py-3.5 font-montserrat text-[14px] font-medium text-[#606060]"
                >
                  <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 truncate">
                    <span className="truncate">
                      {p.paid_at ? formatHistoryDateTime(p.paid_at) : p.period_key}
                    </span>
                    {memoText ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex shrink-0 text-[#606060]"
                            aria-label="Payment memo"
                          >
                            <IconMeno className="size-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          Memo: {memoText}
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </span>
                  <span className={cn("shrink-0 font-montserrat text-[12px]", statusMeta.className)}>
                    {statusMeta.label}
                  </span>
                  <span className="shrink-0">
                    {formatTokenMinor(p.amount_minor, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {p.token}
                  </span>
                  {p.explorerUrl || p.txHash ? (
                    <a
                      href={p.explorerUrl || `https://nearblocks.io/txns/${p.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-primary underline underline-offset-2 hover:opacity-80"
                    >
                      Tx
                    </a>
                  ) : (
                    <span className="w-5 shrink-0" />
                  )}
                </li>
              );
            })}
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

function DetailRow({
  label,
  value,
  icon,
  filled,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  filled: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-full",
          filled ? "bg-primary text-white" : "bg-[#e3e3e3] text-white",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <dt className="font-montserrat text-[14px] font-medium text-[#aaa]">{label}</dt>
        <dd className="mt-1 font-montserrat text-[16px] font-medium text-black">{value}</dd>
      </div>
    </div>
  );
}
