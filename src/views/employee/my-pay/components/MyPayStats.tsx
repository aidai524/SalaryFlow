import { StatCell } from "@/components/stats/StatCell";
import type { MyPayout } from "@/lib/api";
import { CARD_CLASS } from "../config";
import {
  compensationStatValue,
  formatDurationMonths,
  totalReceivedStatValue,
} from "../utils";

export function MyPayStats({
  payout,
  isLoading,
}: {
  payout: MyPayout | null | undefined;
  isLoading: boolean;
}) {
  const placeholder = isLoading ? "…" : "—";

  return (
    <div className={`overflow-hidden ${CARD_CLASS}`}>
      <div className="grid grid-cols-2 divide-x divide-y divide-black/10 md:flex md:flex-row md:divide-y-0">
        <StatCell
          label="Your Compensation"
          value={payout ? compensationStatValue(payout) : placeholder}
        />
        <StatCell
          label="Next payday"
          value={
            payout
              ? (payout.nextPaydayDisplay || payout.nextPayday || "—")
              : placeholder
          }
        />
        <StatCell
          label="Total Received"
          value={payout ? totalReceivedStatValue(payout) : placeholder}
        />
        <StatCell
          label="Duration"
          value={payout ? formatDurationMonths(payout.created_at) : placeholder}
        />
      </div>
    </div>
  );
}
