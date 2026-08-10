import { Link } from "react-router-dom";
import { IconCalendar } from "@/components/icons/calendar";
import { formatCurrencyFromMinor } from "@/lib/format";
import type { OrgOverview } from "@/lib/api";
import { CARD_CLASS } from "../config";

export function UpcomingCard({
  items,
  reviewPeriodKey,
  isLoading,
}: {
  items: OrgOverview["upcoming"] | undefined;
  reviewPeriodKey: string;
  isLoading: boolean;
}) {
  return (
    <section className={`flex h-full flex-col ${CARD_CLASS} p-5 sm:p-6`}>
      <h2 className="mb-4 font-montserrat text-[20px] font-medium text-black">Upcoming</h2>
      <ul className="flex flex-1 flex-col gap-1">
        {isLoading ? (
          <li className="py-6 font-montserrat text-[14px] text-[#909090]">Loading…</li>
        ) : !items || items.length === 0 ? (
          <li className="py-6 font-montserrat text-[14px] text-[#909090]">No upcoming payments</li>
        ) : (
          items.map((item) => (
            <li key={item.periodKey}>
              <Link
                to={`/payments?period=${encodeURIComponent(item.periodKey)}`}
                className="flex items-center gap-3 rounded-[12px] px-1 py-2.5 transition-colors hover:bg-[#f6f6f6]"
              >
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[#4b7cff]/15 text-[#4b7cff]">
                  <IconCalendar className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-montserrat text-[14px] font-medium capitalize text-black">
                    {item.title}
                  </span>
                  <span className="block truncate font-montserrat text-[12px] text-[#909090]">
                    {item.paydayDisplay} | {item.employeeCount} employees
                  </span>
                </span>
                <span className="shrink-0 font-montserrat text-[14px] font-medium text-black">
                  {formatCurrencyFromMinor(item.amountMinor)}
                </span>
                <img src="/icons/to-down.svg" alt="" className="size-2.5 shrink-0 -rotate-90 opacity-40" />
              </Link>
            </li>
          ))
        )}
      </ul>
      <Link
        to={`/payments?period=${encodeURIComponent(reviewPeriodKey)}`}
        className="mt-4 flex h-12 w-full items-center justify-center rounded-[12px] bg-black font-montserrat text-[14px] font-medium text-white transition-opacity hover:opacity-90"
      >
        Review Payments
      </Link>
    </section>
  );
}
