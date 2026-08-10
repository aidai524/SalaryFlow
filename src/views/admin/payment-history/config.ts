export const HISTORY_STATUS = {
  paid: { label: "Paid", className: "text-[#0ed000]" },
  pending: { label: "Pending", className: "text-[#ffa100]" },
} as const;

export function mapPaymentStatus(status: string): "paid" | "pending" {
  return status === "paid" ? "paid" : "pending";
}

export const TYPE_LABEL: Record<string, string> = {
  employee: "Employee",
  contractor: "Contractors",
};

export const CARD_CLASS =
  "rounded-[20px] border border-white bg-[#fdfdfd] shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)]";
