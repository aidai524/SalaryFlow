import type { MyPayout } from "@/lib/api";
import { formatCurrencyFromMinor } from "@/lib/format";
import {
  formatCompensation,
  isVerified,
  roleBadgeAbbrev,
  roleBadgeColor,
  scheduleLabel,
  typeLabel,
} from "@/views/admin/recipients/utils";

export {
  formatCompensation,
  isVerified,
  roleBadgeAbbrev,
  roleBadgeColor,
  scheduleLabel,
  typeLabel,
};

export function firstName(name: string | null | undefined): string {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0] || trimmed;
}

export function formatDurationMonths(createdAt: string | null | undefined): string {
  if (!createdAt) return "—";
  const start = new Date(createdAt);
  if (!Number.isFinite(start.getTime())) return "—";
  const now = new Date();
  let months =
    (now.getUTCFullYear() - start.getUTCFullYear()) * 12
    + (now.getUTCMonth() - start.getUTCMonth());
  if (now.getUTCDate() < start.getUTCDate()) months -= 1;
  months = Math.max(0, months);
  if (months === 1) return "1 month";
  return `${months} months`;
}

export function compensationStatValue(payout: MyPayout | null | undefined): string {
  if (!payout || payout.amount_minor <= 0) return "—";
  return formatCurrencyFromMinor(payout.amount_minor);
}

export function totalReceivedStatValue(payout: MyPayout | null | undefined): string {
  if (!payout) return "—";
  return formatCurrencyFromMinor(payout.totalReceivedMinor || 0);
}

export function statusLabel(status: string): string {
  if (status === "paid") return "Success";
  if (status === "processing") return "Processing";
  if (status === "failed") return "Failed";
  if (status === "refunded") return "Refunded";
  return "Pending";
}
