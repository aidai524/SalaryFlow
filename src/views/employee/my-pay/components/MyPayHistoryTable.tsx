import { IconCheck } from "@/components/icons/check";
import type { MyPaymentHistoryItem } from "@/lib/api";
import { formatAddress, formatDateTime, formatTokenMinor } from "@/lib/format";
import { tokenLogoUrl } from "@/lib/logo";
import { cn } from "@/lib/utils";
import { CARD_CLASS, HISTORY_COLUMNS } from "../config";
import { statusLabel } from "../utils";

export function MyPayHistoryTable({
  payments,
  isLoading,
  className,
}: {
  payments: MyPaymentHistoryItem[];
  isLoading: boolean;
  className?: string;
}) {
  return (
    <section className={cn("flex min-h-[420px] flex-col overflow-hidden", CARD_CLASS, className)}>
      <div className="min-h-0 flex-1 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-black/10">
              {HISTORY_COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="px-6 py-5 text-left font-montserrat text-[14px] font-medium text-[#606060]"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={HISTORY_COLUMNS.length}
                  className="px-6 py-16 text-center font-montserrat text-[14px] text-[#909090]"
                >
                  Loading payment history…
                </td>
              </tr>
            ) : payments.length === 0 ? (
              <tr>
                <td
                  colSpan={HISTORY_COLUMNS.length}
                  className="px-6 py-16 text-center font-montserrat text-[14px] text-[#909090]"
                >
                  No payments yet
                </td>
              </tr>
            ) : (
              payments.map((row, index) => (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-black/10 last:border-b-0",
                    index % 2 === 1 && "bg-[#f6f6f6]",
                  )}
                >
                  <td className="px-6 py-4 font-montserrat text-[14px] text-black">
                    {formatTokenMinor(row.amount_minor, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 font-montserrat text-[14px] text-black">
                      <img
                        src={tokenLogoUrl(row.token)}
                        alt=""
                        className="size-4 rounded-full object-cover"
                      />
                      {row.token} · {row.network}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-montserrat text-[14px] text-black">
                    {row.fromAddress ? formatAddress(row.fromAddress, 5, 5) : "—"}
                  </td>
                  <td className="px-6 py-4 font-montserrat text-[14px] text-black">
                    {row.paid_at ? formatDateTime(row.paid_at) : "—"}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <StatusPill status={row.status} />
                      {row.explorerUrl || row.txHash ? (
                        <a
                          href={row.explorerUrl || `#`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-montserrat text-[14px] text-[#3f8afb] underline underline-offset-2 hover:opacity-80"
                        >
                          Tx
                        </a>
                      ) : null}
                    </div>
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

function StatusPill({ status }: { status: string }) {
  const label = statusLabel(status);
  const success = status === "paid";
  return (
    <span
      className={cn(
        "inline-flex h-[30px] min-w-[105px] items-center justify-center gap-1.5 rounded-[25px] px-3 font-montserrat text-[14px] font-medium",
        success
          ? "bg-[#d0f348]/20 text-[#769400]"
          : "bg-black/5 text-[#606060]",
      )}
    >
      {success ? <IconCheck className="size-2.5 text-[#769400]" /> : null}
      {label}
    </span>
  );
}
