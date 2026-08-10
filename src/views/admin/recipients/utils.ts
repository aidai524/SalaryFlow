import type { ContractorPaymentCadence, Employee, TeamPaymentSchedule } from "@/lib/api";
import { formatTokenMinor } from "@/lib/format";

export function formatCompensation(emp: Pick<Employee, "amount_minor" | "payment_cadence">): string {
  const amount = `$${formatTokenMinor(emp.amount_minor, { maximumFractionDigits: 2 })}`;
  const cadence = emp.payment_cadence;
  if (cadence === "weekly") return `${amount} / week`;
  if (cadence === "on_demand") return `${amount} / period`;
  return `${amount} / month`;
}

export function scheduleLabel(
  cadence: ContractorPaymentCadence | TeamPaymentSchedule | null | undefined,
): string {
  if (cadence === "weekly") return "Weekly";
  if (cadence === "on_demand") return "On Demand";
  if (cadence === "monthly") return "Monthly";
  return "—";
}

export function roleBadgeAbbrev(role: string | null | undefined): string {
  const key = String(role || "").trim().toLowerCase();
  if (key.startsWith("dev")) return "DEV";
  if (key.startsWith("prod")) return "PDT";
  if (key.startsWith("grow") || key.includes("market") || key === "mkt") return "GRW";
  if (key.startsWith("fin")) return "FIN";
  if (key.startsWith("oper") || key === "ops") return "OPS";
  if (key.startsWith("des")) return "DES";
  if (!key) return "—";
  return key.slice(0, 3).toUpperCase();
}

/** Match QuickPayPanel role badge colors. */
export function roleBadgeColor(role: string | null | undefined): string {
  const key = String(role || "").toLowerCase();
  if (key.includes("market") || key === "mkt" || key.includes("grow")) {
    return "bg-[#e89300]/10 text-[#e89300]";
  }
  if (key.includes("dev")) return "bg-[#4a7dff]/10 text-[#4a7dff]";
  return "bg-black/5 text-[#909090]";
}

export function isVerified(emp: Pick<Employee, "payout_verified_at" | "status">): boolean {
  return Boolean(emp.payout_verified_at) && emp.status === "ready";
}

export function typeLabel(type: Employee["employee_type"]): string {
  return type === "contractor" ? "Contractor" : "Employee";
}

export function payStatusLabel(status: Employee["payStatus"]): string | null {
  if (status === "to_be_paid") return "To be paid";
  if (status === "paid") return "Paid";
  return null;
}

export function payStatusClass(status: Employee["payStatus"]): string {
  if (status === "to_be_paid") return "bg-[#9a7bff]/15 text-[#9a7bff]";
  if (status === "paid") return "bg-[#0ed000]/15 text-[#0ed000]";
  return "";
}
