import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { IdentityAvatar } from "@/components/IdentityAvatar";
import { IconAlert } from "@/components/icons/alert";
import { IconCheck } from "@/components/icons/check";
import { QuickPayPanel } from "@/components/quick-pay/QuickPayPanel";
import { usePayOverviewQuery } from "@/hooks/use-pay-api";
import { formatCurrencyFromMinor, formatDate } from "@/lib/format";
import { useAuthStore } from "@/stores/auth";
import { useIntentsTokensStore } from "@/stores/intents-tokens";

function StatCell({
  label,
  value,
  trailing,
}: {
  label: string;
  value: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="min-w-0 flex-1 px-4 py-4 first:pl-5 last:pr-5 sm:px-6">
      <p className="font-montserrat text-[14px] font-medium capitalize text-[#606060]">{label}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <p className="font-montserrat text-[20px] font-semibold capitalize text-black">{value}</p>
        {trailing}
      </div>
    </div>
  );
}

function VerifiedPill({ verified }: { verified: boolean }) {
  if (verified) {
    return (
      <span className="inline-flex h-6 items-center gap-1 rounded-[12px] bg-[#0ed000]/10 px-2 font-montserrat text-[12px] text-[#0ed000]">
        <span className="inline-flex size-3 items-center justify-center rounded-full bg-[#0ed000] text-white">
          <IconCheck className="size-2" />
        </span>
        Verified
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 items-center rounded-[12px] bg-[#aaa]/10 px-2.5 font-montserrat text-[12px] text-[#aaa]">
      Unverified
    </span>
  );
}

export function PayView() {
  const orgName = useAuthStore((s) => s.orgName) || "Team";
  const ensureFresh = useIntentsTokensStore((s) => s.ensureFresh);
  const { data, isLoading, isError, error } = usePayOverviewQuery();

  useEffect(() => {
    void ensureFresh();
  }, [ensureFresh]);

  const stats = data?.stats;
  const period = data?.period;

  return (
    <div className="pb-10 pt-4 md:pt-5">
      {/* Greeting + disabled team switcher */}
      <div className="mb-4 flex items-center gap-2">
        <h1 className="font-montserrat text-[22px] font-medium text-black sm:text-[26px]">
          Hi! {orgName}
        </h1>
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Team switching coming soon"
          className="inline-flex size-7 items-center justify-center rounded-full opacity-40"
        >
          <img src="/icons/to-down.svg" alt="" className="size-3.5" />
        </button>
      </div>

      {/* Stats strip */}
      <div className="mb-5 overflow-hidden rounded-[20px] border border-white bg-[#fdfdfd] shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col divide-y divide-black/10 md:flex-row md:divide-x md:divide-y-0">
          <StatCell
            label="Current Payroll"
            value={stats ? formatCurrencyFromMinor(stats.currentPayrollMinor) : isLoading ? "…" : "$0.00"}
          />
          <StatCell
            label="Expired Date"
            value={
              period
                ? period.paydayDisplay || formatDate(period.payday)
                : isLoading
                  ? "…"
                  : "—"
            }
          />
          <StatCell
            label="Recipients"
            value={stats ? String(stats.recipientsCount) : isLoading ? "…" : "0"}
            trailing={null}
          />
          <StatCell
            label="payment progress"
            value={stats ? `${stats.progress}%` : isLoading ? "…" : "0%"}
          />
        </div>
      </div>

      {isError ? (
        <p className="mb-4 font-montserrat text-[14px] text-red-600">
          {error instanceof Error ? error.message : "Failed to load pay overview"}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,776fr)_minmax(0,604fr)]">
        <QuickPayPanel />

        <div className="flex flex-col gap-5">
          {/* Recipients card */}
          <section className="rounded-[20px] border border-white bg-[#fdfdfd] p-5 shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)] sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-montserrat text-[20px] font-medium capitalize text-black">
                Recipients
              </h2>
              <Link
                to="/recipients"
                className="inline-flex items-center gap-1 font-montserrat text-[12px] text-[#606060] transition-colors hover:text-black"
              >
                View All
                <img src="/icons/to-down.svg" alt="" className="size-2 -rotate-90 opacity-50" />
              </Link>
            </div>
            <ul className="flex flex-col gap-1">
              {(data?.recipients || []).map((r) => (
                <li key={r.id}>
                  <Link
                    to={`/recipients?selected=${r.id}`}
                    className="flex items-center gap-3 rounded-[12px] px-2 py-2 transition-colors hover:bg-[#f6f6f6]"
                  >
                    <IdentityAvatar seed={r.name} size={32} alt="" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-montserrat text-[14px] font-medium text-black">
                        {r.name}
                      </span>
                      <span className="block truncate font-montserrat text-[10px] text-[#606060]">
                        {r.role_title || "—"}
                      </span>
                    </span>
                    <VerifiedPill verified={r.verified} />
                    <img
                      src="/icons/to-down.svg"
                      alt=""
                      className="size-2.5 shrink-0 -rotate-90 opacity-40"
                    />
                  </Link>
                </li>
              ))}
              {!isLoading && (!data?.recipients || data.recipients.length === 0) && (
                <li className="px-2 py-6 font-montserrat text-[14px] text-[#606060]">
                  No recipients yet
                </li>
              )}
            </ul>
          </section>

          {/* High Priority card */}
          <section className="rounded-[20px] border border-white bg-[#fdfdfd] p-5 shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)] sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-montserrat text-[20px] font-medium capitalize text-black">
                High Priority
              </h2>
              {/* TODO(high-priority): View All destination not designed yet. */}
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1 font-montserrat text-[12px] text-[#606060] opacity-50"
              >
                View All
                <img src="/icons/to-down.svg" alt="" className="size-2 -rotate-90" />
              </button>
            </div>

            <ul className="flex flex-col">
              {data?.highPriority.verification ? (
                <li>
                  {/* TODO(high-priority): detail navigation not designed yet. */}
                  <button
                    type="button"
                    disabled
                    className="flex w-full items-center gap-3 py-4 text-left opacity-90"
                  >
                    <span className="inline-flex size-8 items-center justify-center rounded-full bg-[#e89300]/15 text-[#e89300]">
                      <IconAlert className="size-3" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-montserrat text-[14px] font-medium text-black">
                        {data.highPriority.verification.count} recipients need verification
                      </span>
                      <span className="block truncate font-montserrat text-[10px] text-[#606060]">
                        {data.highPriority.verification.names.join(" and ")}
                      </span>
                    </span>
                    <img src="/icons/to-down.svg" alt="" className="size-2.5 -rotate-90 opacity-40" />
                  </button>
                </li>
              ) : null}

              {!isLoading && !data?.highPriority.verification && (
                <li className="py-6 font-montserrat text-[14px] text-[#606060]">
                  Nothing needs attention
                </li>
              )}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
