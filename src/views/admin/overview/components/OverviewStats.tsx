import { StatCell } from "@/components/stats/StatCell";
import { formatCurrencyFromMinor } from "@/lib/format";
import type { OrgOverview } from "@/lib/api";
import { CARD_CLASS } from "../config";

export function OverviewStats({
  stats,
  paydayDisplay,
  isLoading,
}: {
  stats: OrgOverview["stats"] | undefined;
  paydayDisplay: string | undefined;
  isLoading: boolean;
}) {
  const daysLeft = stats?.daysLeft ?? 0;
  const daysLabel = daysLeft > 0 ? `${daysLeft} Days Left` : null;

  return (
    <div className={`mb-5 overflow-hidden ${CARD_CLASS}`}>
      <div className="flex flex-col divide-y divide-black/10 md:flex-row md:divide-x md:divide-y-0">
        <StatCell
          label="Paid This Period"
          value={stats ? formatCurrencyFromMinor(stats.paidMinor) : isLoading ? "…" : "$0.00"}
          subtitle={stats ? `For ${stats.paidCount} Employees` : null}
        />
        <StatCell
          label="Awaiting Actions"
          value={stats ? formatCurrencyFromMinor(stats.awaitingMinor) : isLoading ? "…" : "$0.00"}
          subtitle={stats ? `${stats.awaitingCount} Payments` : null}
        />
        <StatCell
          label="Next Payment Day"
          value={stats ? paydayDisplay || "—" : isLoading ? "…" : "—"}
          subtitle={stats ? daysLabel : null}
        />
        <StatCell
          label="Payment Progress"
          value={stats ? `${stats.progress}%` : isLoading ? "…" : "0%"}
          subtitle={stats ? `${stats.recipientsCount} Employees` : null}
        />
      </div>
    </div>
  );
}
