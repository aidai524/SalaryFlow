import { useEffect, useState } from "react";
import {
  PaymentPeriodPicker,
  periodKeyFromDate,
} from "@/components/payment-period-picker/PaymentPeriodPicker";
import { useOrgOverviewQuery } from "@/hooks/use-overview-api";
import { useOrgContextQuery } from "@/hooks/use-org-api";
import type { TeamPaymentSchedule } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { DEFAULT_PAYMENT_SCHEDULE } from "./create-team/config";
import { OverviewStats } from "./overview/components/OverviewStats";
import { PaymentVolumeCard } from "./overview/components/PaymentVolumeCard";
import { PayoutNetworksCard } from "./overview/components/PayoutNetworksCard";
import { RecentPaymentCard } from "./overview/components/RecentPaymentCard";
import { SpendCategoryCard } from "./overview/components/SpendCategoryCard";
import { UpcomingCard } from "./overview/components/UpcomingCard";
import type { VolumeRange } from "./overview/config";

export function OverviewView() {
  const orgId = useAuthStore((s) => s.orgId);
  const orgName = useAuthStore((s) => s.orgName) || "Team";
  const { data: orgContext } = useOrgContextQuery(orgId);
  const teamCadence = (orgContext?.org.payment_cadence || DEFAULT_PAYMENT_SCHEDULE) as TeamPaymentSchedule;

  const [periodKey, setPeriodKey] = useState(() => periodKeyFromDate(teamCadence));
  const [volumeRange, setVolumeRange] = useState<VolumeRange>(6);

  useEffect(() => {
    setPeriodKey(periodKeyFromDate(teamCadence));
  }, [teamCadence]);

  const { data, isLoading, isError, error } = useOrgOverviewQuery({
    periodKey,
    volumeRange,
  });

  return (
    <div className="pb-10 pt-4 md:pt-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-montserrat text-[22px] font-medium text-black sm:text-[26px]">Overview</h1>
          <p className="mt-1 font-montserrat text-[14px] text-[#606060]">
            Payments across {orgName}
          </p>
        </div>
        <PaymentPeriodPicker
          cadence={teamCadence}
          value={periodKey}
          onChange={setPeriodKey}
          labelFormat="short"
        />
      </div>

      {isError ? (
        <p className="mb-4 font-montserrat text-[14px] text-red-600">
          {error instanceof Error ? error.message : "Failed to load overview"}
        </p>
      ) : null}

      <OverviewStats
        stats={data?.stats}
        paydayDisplay={data?.period.paydayDisplay}
        isLoading={isLoading}
      />

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <PaymentVolumeCard
          cadence={teamCadence}
          volumeRange={volumeRange}
          onVolumeRangeChange={setVolumeRange}
          bars={data?.volume.bars}
          isLoading={isLoading}
        />
        <UpcomingCard
          items={data?.upcoming}
          reviewPeriodKey={periodKey}
          isLoading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.85fr)_minmax(0,0.85fr)]">
        <RecentPaymentCard
          items={data?.recentPayments}
          viewAllPeriodKey={periodKey}
          isLoading={isLoading}
        />
        <SpendCategoryCard category={data?.category} isLoading={isLoading} />
        <PayoutNetworksCard networks={data?.networks} isLoading={isLoading} />
      </div>
    </div>
  );
}
