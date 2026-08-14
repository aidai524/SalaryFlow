import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BatchPayoutDialog } from "@/components/batch-payout/BatchPayoutDialog";
import {
  formatPeriodLabel,
  periodKeyFromDate,
} from "@/components/payment-period-picker/PaymentPeriodPicker";
import { SearchInput } from "@/components/search-input/SearchInput";
import { useOrgPaymentsQuery } from "@/hooks/use-overview-api";
import { useOrgContextQuery } from "@/hooks/use-org-api";
import type { TeamPaymentSchedule } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { DEFAULT_PAYMENT_SCHEDULE } from "./create-team/config";
import { BatchHistoryList } from "./payment-history/components/BatchHistoryList";
import { HistoryTabs } from "./payment-history/components/HistoryTabs";
import { PaymentHistoryTable } from "./payment-history/components/PaymentHistoryTable";
import { CARD_CLASS } from "./payment-history/config";
import { PayNowDialog } from "./recipients/components/PayNowDialog";

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
  const [tab, setTab] = useState<"payments" | "batches">("payments");
  const [payNowId, setPayNowId] = useState<string | null>(null);
  const [batchRetryIds, setBatchRetryIds] = useState<string[] | null>(null);

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

      <HistoryTabs value={tab} onChange={setTab} />

      {isError && tab === "payments" ? (
        <p className="mb-4 font-montserrat text-[14px] text-red-600">
          {error instanceof Error ? error.message : "Failed to load payment history"}
        </p>
      ) : null}

      {tab === "payments" ? (
        <section className={`${CARD_CLASS} overflow-hidden`}>
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="font-montserrat text-[14px] font-medium text-black">{periodTitle}</p>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search Recipient"
              className="max-w-[230px]"
            />
          </div>
          <PaymentHistoryTable payments={data?.payments} isLoading={isLoading} />
        </section>
      ) : (
        <section className={`${CARD_CLASS} overflow-hidden`}>
          <BatchHistoryList
            onRetryOne={(employeeId) => setPayNowId(employeeId)}
            onRetryFailed={(ids) => setBatchRetryIds(ids)}
          />
        </section>
      )}

      <PayNowDialog
        open={!!payNowId}
        onOpenChange={(next) => {
          if (!next) setPayNowId(null);
        }}
        employeeId={payNowId}
      />
      <BatchPayoutDialog
        open={!!batchRetryIds}
        onOpenChange={(next) => {
          if (!next) setBatchRetryIds(null);
        }}
        initialEmployeeIds={batchRetryIds || undefined}
      />
    </div>
  );
}
