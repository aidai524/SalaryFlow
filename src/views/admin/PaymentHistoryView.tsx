import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  formatPeriodLabel,
  periodKeyFromDate,
} from "@/components/payment-period-picker/PaymentPeriodPicker";
import { useOrgPaymentsQuery } from "@/hooks/use-overview-api";
import { useOrgContextQuery } from "@/hooks/use-org-api";
import type { TeamPaymentSchedule } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { DEFAULT_PAYMENT_SCHEDULE } from "./create-team/config";
import { PaymentHistoryTable } from "./payment-history/components/PaymentHistoryTable";
import { CARD_CLASS } from "./payment-history/config";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export function PaymentHistoryView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orgId = useAuthStore((s) => s.orgId);
  const { data: orgContext } = useOrgContextQuery(orgId);
  const teamCadence = (orgContext?.org.payment_cadence || DEFAULT_PAYMENT_SCHEDULE) as TeamPaymentSchedule;

  const periodFromUrl = searchParams.get("period")?.trim() || "";
  const periodKey = periodFromUrl || periodKeyFromDate(teamCadence);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);

  const { data, isLoading, isError, error } = useOrgPaymentsQuery({
    periodKey,
    q: debouncedSearch.trim() || undefined,
  });

  const periodTitle = formatPeriodLabel(teamCadence, periodKey, "short");

  return (
    <div className="pb-10 pt-4 md:pt-5">
      <div className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="inline-flex size-7 items-center justify-center rounded-full bg-[#ebebeb] transition-colors hover:bg-[#e0e0e0]"
        >
          <img src="/icons/to-down.svg" alt="" className="size-2.5 rotate-90" />
        </button>
        <h1 className="font-montserrat text-[18px] font-medium text-black">Payment History</h1>
      </div>

      {isError ? (
        <p className="mb-4 font-montserrat text-[14px] text-red-600">
          {error instanceof Error ? error.message : "Failed to load payment history"}
        </p>
      ) : null}

      <section className={`${CARD_CLASS} overflow-hidden`}>
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="font-montserrat text-[14px] font-medium text-black">{periodTitle}</p>
          <label className="relative block w-full max-w-[230px]">
            <img
              src="/icons/search.svg"
              alt=""
              className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 opacity-50"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Recipient"
              className="h-9 w-full rounded-[18px] border border-[#ebebeb] bg-white pl-9 pr-3 font-montserrat text-[14px] text-black outline-none placeholder:text-[#909090] focus:border-black/30"
            />
          </label>
        </div>
        <PaymentHistoryTable payments={data?.payments} isLoading={isLoading} />
      </section>
    </div>
  );
}
