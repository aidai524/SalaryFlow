export const HISTORY_STATUS = {
  paid: { label: "Paid", className: "text-[#0ed000]" },
  pending: { label: "Pending", className: "text-[#ffa100]" },
  processing: { label: "Processing", className: "text-[#ffa100]" },
  failed: { label: "Failed", className: "text-[#e5484d]" },
  refunded: { label: "Refunded", className: "text-[#909090]" },
} as const;

export type HistoryStatusKey = keyof typeof HISTORY_STATUS;

export function mapPaymentStatus(status: string): HistoryStatusKey {
  if (status === "paid") return "paid";
  if (status === "failed") return "failed";
  if (status === "refunded") return "refunded";
  if (status === "processing") return "processing";
  return "pending";
}

export const TYPE_LABEL: Record<string, string> = {
  employee: "Employee",
  contractor: "Contractors",
  others: "Others",
};

export const CARD_CLASS =
  "rounded-[20px] border border-white bg-[#fdfdfd] shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)]";

export const BATCH_HISTORY_PAGE_SIZE = 10;
