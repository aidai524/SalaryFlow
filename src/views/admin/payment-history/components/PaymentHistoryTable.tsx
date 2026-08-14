import { IdentityAvatar } from "@/components/IdentityAvatar";
import { IconAlert } from "@/components/icons/alert";
import { IconCheck } from "@/components/icons/check";
import { formatDateTime, formatTokenMinor } from "@/lib/format";
import { tokenLogoUrl } from "@/lib/logo";
import type { OrgPaymentRow } from "@/lib/api";
import { HISTORY_STATUS, TYPE_LABEL, mapPaymentStatus } from "../config";
import { HistoryMemoCell } from "./HistoryMemoCell";
import { TxLink } from "./TxLink";
import clsx from "clsx";

export function PaymentHistoryTable({
  payments,
  isLoading,
}: {
  payments: OrgPaymentRow[] | undefined;
  isLoading: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1120px] border-collapse">
        <thead>
          <tr className="border-b border-[#ebebeb] text-left">
            <th className="px-5 py-4 font-montserrat text-[14px] font-medium text-[#606060]">Name</th>
            <th className="px-3 py-4 font-montserrat text-[14px] font-medium text-[#606060]">Type</th>
            <th className="px-3 py-4 font-montserrat text-[14px] font-medium text-[#606060]">Amount</th>
            <th className="px-3 py-4 font-montserrat text-[14px] font-medium text-[#606060]">Token</th>
            <th className="px-3 py-4 font-montserrat text-[14px] font-medium text-[#606060]">Memo</th>
            <th className="px-3 py-4 font-montserrat text-[14px] font-medium text-[#606060]">Payment Date</th>
            <th className="px-3 py-4 font-montserrat text-[14px] font-medium text-[#606060]">Payment Tx</th>
            <th className="px-3 py-4 font-montserrat text-[14px] font-medium text-[#606060]">Receive Tx</th>
            <th className="px-5 py-4 font-montserrat text-[14px] font-medium text-[#606060]">Status</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={9} className="px-5 py-10 font-montserrat text-[14px] text-[#909090]">
                Loading…
              </td>
            </tr>
          ) : !payments || payments.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-5 py-10 font-montserrat text-[14px] text-[#909090]">
                No payments in this period
              </td>
            </tr>
          ) : (
            payments.map((row, index) => {
              const statusKey = mapPaymentStatus(row.status);
              const status = HISTORY_STATUS[statusKey];
              const zebra = index % 2 === 1;
              return (
                <tr
                  key={row.id}
                  className={`border-b border-[#ebebeb] ${zebra ? "bg-[#f6f6f6]" : "bg-transparent"}`}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <IdentityAvatar seed={row.name} size={32} alt="" />
                      <div className="min-w-0">
                        <p className="truncate font-montserrat text-[14px] font-medium text-black">
                          {row.name}
                        </p>
                        <p className="truncate font-montserrat text-[10px] text-[#606060]">
                          {row.role_title || "—"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3.5 font-montserrat text-[14px] text-black">
                    {TYPE_LABEL[row.employee_type] || row.employee_type}
                  </td>
                  <td className="px-3 py-3.5 font-montserrat text-[14px] text-black">
                    {formatTokenMinor(row.amount_minor, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-2">
                      <img
                        src={tokenLogoUrl(row.token)}
                        alt=""
                        className="size-4 rounded-full object-cover"
                      />
                      <span className="font-montserrat text-[14px] text-black">
                        {row.token} · {row.network}
                      </span>
                    </div>
                  </td>
                  <td className="max-w-[160px] px-3 py-3.5">
                    <HistoryMemoCell memo={row.memo} />
                  </td>
                  <td className="px-3 py-3.5 font-montserrat text-[14px] text-black">
                    {formatDateTime(row.paid_at)}
                  </td>
                  <td className="px-3 py-3.5">
                    <TxLink href={row.adminExplorerUrl} hash={row.adminTxHash} />
                  </td>
                  <td className="px-3 py-3.5">
                    <TxLink href={row.receiveExplorerUrl} hash={row.receiveTxHash} />
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 font-space-grotesk text-[12px] ${status.className}`}>
                      <span className={clsx(
                        "size-3 rounded-full shrink-0 flex justify-center items-center",
                        statusKey === "paid" ? "bg-[#0ED000]/20" : "bg-[#FFA200]/20",
                      )}>
                        {statusKey === "paid" ? (
                          <IconCheck className="size-1.5" />
                        ) : (
                          <IconAlert className="size-1.5" />
                        )}
                      </span>
                      {status.label}
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
