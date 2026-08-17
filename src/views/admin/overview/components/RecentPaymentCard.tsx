import { Link } from "react-router-dom";
import { IdentityAvatar, identityAvatarSeed } from "@/components/IdentityAvatar";
import { IconCheck } from "@/components/icons/check";
import { IconLoading } from "@/components/icons/loading";
import { formatDateTime, formatTokenMinor } from "@/lib/format";
import { tokenLogoUrl } from "@/lib/logo";
import type { OrgOverview } from "@/lib/api";
import { CARD_CLASS } from "../config";

export function RecentPaymentCard({
  items,
  viewAllPeriodKey,
  isLoading,
}: {
  items: OrgOverview["recentPayments"] | undefined;
  viewAllPeriodKey: string;
  isLoading: boolean;
}) {
  return (
    <section className={`${CARD_CLASS} p-5 sm:p-6`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-montserrat text-[20px] font-medium text-black">Recent Payment</h2>
        <Link
          to={`/payments?period=${encodeURIComponent(viewAllPeriodKey)}`}
          className="inline-flex items-center gap-1.5 font-montserrat text-[12px] text-[#606060] transition-colors hover:text-black"
        >
          View All
          <img src="/icons/all.svg" alt="" className="h-2.5 w-auto" />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse">
          <thead>
            <tr className="text-left">
              <th className="pb-3 font-montserrat text-[12px] font-medium text-[#909090]">Payment</th>
              <th className="pb-3 font-montserrat text-[12px] font-medium text-[#909090]">Volume</th>
              <th className="pb-3 text-right font-montserrat text-[12px] font-medium text-[#909090]">Time</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={3} className="py-8 font-montserrat text-[14px] text-[#909090]">
                  Loading…
                </td>
              </tr>
            ) : !items || items.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-8 font-montserrat text-[14px] text-[#909090]">
                  No recent payments
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id} className="border-t border-[#ebebeb]">
                  <td className="py-3">
                    <div className="flex items-center gap-2.5">
                      <IdentityAvatar
                        seed={identityAvatarSeed({ id: row.employeeId, name: row.name })}
                        src={row.avatar_url}
                        size={28}
                        alt=""
                      />
                      <span className="font-montserrat text-[14px] text-black">{row.name}</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <img
                        src={tokenLogoUrl(row.token)}
                        alt=""
                        className="size-4 rounded-full object-cover"
                      />
                      <span className="font-montserrat text-[13px] text-black">
                        {formatTokenMinor(row.amount_minor, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {row.token} ·{" "}
                        {row.network}
                      </span>
                      {row.status === "processing" ? (
                        <IconLoading className="size-3.5 animate-spin text-[#4b7cff]" />
                      ) : (
                        <span className="inline-flex size-4 items-center justify-center rounded-full bg-[#0ed000]/15 text-[#0ed000]">
                          <IconCheck className="size-2" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 text-right font-montserrat text-[13px] text-[#606060]">
                    {formatDateTime(row.paid_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
