import type { OrgOverview } from "@/lib/api";
import { CARD_CLASS } from "../config";

export function PayoutNetworksCard({
  networks,
  isLoading,
}: {
  networks: OrgOverview["networks"] | undefined;
  isLoading: boolean;
}) {
  return (
    <section className={`${CARD_CLASS} p-5 sm:p-6`}>
      <h2 className="mb-5 font-montserrat text-[20px] font-medium text-black">Payout Networks</h2>
      {isLoading ? (
        <p className="py-8 font-montserrat text-[14px] text-[#909090]">Loading…</p>
      ) : !networks || networks.length === 0 ? (
        <p className="py-8 font-montserrat text-[14px] text-[#909090]">No payout networks yet</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {networks.map((row) => (
            <li key={row.network}>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="font-montserrat text-[14px] text-black">{row.network}</span>
                <span className="font-montserrat text-[13px] text-[#606060]">{row.pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#ebebeb]">
                <div
                  className="h-full rounded-full bg-black transition-[width]"
                  style={{ width: `${Math.max(row.pct, row.pct > 0 ? 2 : 0)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
