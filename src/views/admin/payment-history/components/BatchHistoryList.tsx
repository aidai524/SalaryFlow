import { useState } from "react";
import Pagination from "@/components/pagination";
import { TokenChainIcon } from "@/components/batch-payout/TokenChainIcon";
import {
  usePaymentBatchDetailQuery,
  usePaymentBatchesQuery,
} from "@/hooks/use-batch-payout-api";
import { formatDateTime, formatTokenMinor } from "@/lib/format";
import type { PaymentBatchItemRow, PaymentBatchSummary } from "@/lib/api";
import { BATCH_HISTORY_PAGE_SIZE, HISTORY_STATUS, mapPaymentStatus } from "../config";
import { HistoryMemoCell } from "./HistoryMemoCell";
import { TxLink } from "./TxLink";

function batchStatusLabel(status: PaymentBatchSummary["status"]) {
  if (status === "completed") return { label: "Completed", className: "text-[#0ed000]" };
  if (status === "partial") return { label: "Partial", className: "text-[#ffa100]" };
  if (status === "failed") return { label: "Failed", className: "text-[#e5484d]" };
  return { label: "Processing", className: "text-[#ffa100]" };
}

function BatchRow({
  batch,
  onRetryOne,
  onRetryFailed,
}: {
  batch: PaymentBatchSummary;
  onRetryOne: (employeeId: string) => void;
  onRetryFailed: (employeeIds: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const detail = usePaymentBatchDetailQuery(batch.id, open);
  const status = batchStatusLabel(batch.status);
  const failedIds = (detail.data?.items || [])
    .filter((item) => item.status === "failed" || item.status === "refunded")
    .map((item) => item.employeeId)
    .filter((id): id is string => Boolean(id));

  return (
    <div className="border-b border-black/5 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-[#fafafa]"
      >
        <div>
          <p className="font-montserrat text-[14px] font-medium text-black">
            {formatDateTime(batch.createdAt)}
          </p>
          <p className="font-montserrat text-[12px] text-[#909090]">
            {batch.itemCount} recipients · {batch.originToken} · {batch.originNetwork}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-montserrat text-[13px] text-black">
            {batch.paidCount}/{batch.itemCount} paid
          </span>
          <span className={`font-montserrat text-[13px] ${status.className}`}>{status.label}</span>
        </div>
      </button>
      {open ? (
        <div className="bg-[#fafafa] px-5 py-3">
          {detail.isLoading ? (
            <p className="py-4 font-montserrat text-[13px] text-[#909090]">Loading details…</p>
          ) : (
            <>
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-black/10">
                    {["Name", "Amount", "Memo", "Payment Tx", "Receive Tx", "Status", ""].map((label) => (
                      <th
                        key={label || "actions"}
                        className="px-2 py-2 font-montserrat text-[12px] font-medium text-[#909090]"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(detail.data?.items || []).map((item: PaymentBatchItemRow) => {
                    const itemStatus = mapPaymentStatus(item.status);
                    const failed = itemStatus === "failed" || itemStatus === "refunded";
                    return (
                      <tr key={item.id} className="border-b border-black/5 last:border-b-0">
                        <td className="px-2 py-2 font-montserrat text-[13px] text-black">{item.employeeName}</td>
                        <td className="px-2 py-2">
                          <span className="inline-flex items-center gap-2 font-montserrat text-[13px] text-black">
                            {formatTokenMinor(item.amountMinor, { maximumFractionDigits: 6 })}
                            <TokenChainIcon token={item.token} network={item.network} />
                          </span>
                        </td>
                        <td className="max-w-[140px] px-2 py-2">
                          <HistoryMemoCell
                            memo={item.memo}
                            className="text-[12px] text-[#606060]"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <TxLink href={item.adminExplorerUrl} hash={item.adminTxHash} />
                        </td>
                        <td className="px-2 py-2">
                          <TxLink href={item.receiveExplorerUrl} hash={item.receiveTxHash} />
                        </td>
                        <td className={`px-2 py-2 font-montserrat text-[13px] ${HISTORY_STATUS[itemStatus].className}`}>
                          {HISTORY_STATUS[itemStatus].label}
                        </td>
                        <td className="px-2 py-2">
                          {failed && item.employeeId ? (
                            <button
                              type="button"
                              onClick={() => onRetryOne(item.employeeId!)}
                              className="font-montserrat text-[12px] text-black underline-offset-2 hover:underline"
                            >
                              Retry pay
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {failedIds.length > 0 ? (
                <button
                  type="button"
                  onClick={() => onRetryFailed(failedIds)}
                  className="mt-3 h-9 rounded-[12px] border border-black/10 px-3 font-montserrat text-[12px] font-medium text-black hover:bg-black/5"
                >
                  Retry failed in batch
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function BatchHistoryList({
  onRetryOne,
  onRetryFailed,
}: {
  onRetryOne: (employeeId: string) => void;
  onRetryFailed: (employeeIds: string[]) => void;
}) {
  const [page, setPage] = useState(1);
  const query = usePaymentBatchesQuery(page, BATCH_HISTORY_PAGE_SIZE);
  const total = query.data?.total || 0;
  const totalPage = Math.max(1, Math.ceil(total / BATCH_HISTORY_PAGE_SIZE));

  if (query.isLoading && !query.data) {
    return <p className="px-5 py-10 font-montserrat text-[14px] text-[#909090]">Loading…</p>;
  }
  if (!query.data?.batches.length) {
    return <p className="px-5 py-10 font-montserrat text-[14px] text-[#909090]">No batch payouts yet</p>;
  }

  return (
    <div>
      {query.data.batches.map((batch) => (
        <BatchRow
          key={batch.id}
          batch={batch}
          onRetryOne={onRetryOne}
          onRetryFailed={onRetryFailed}
        />
      ))}
      {totalPage > 1 ? (
        <div className="flex justify-end px-5 py-3">
          <Pagination
            page={page}
            pageSize={BATCH_HISTORY_PAGE_SIZE}
            totalPage={totalPage}
            onPageChange={setPage}
          />
        </div>
      ) : null}
    </div>
  );
}
