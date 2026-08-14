import type { Employee, MyPayout } from "@/lib/api";
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

export function employeeFromMyPayout(payout: MyPayout, userId: string | null): Employee {
  return {
    id: payout.id,
    user_id: userId,
    email: payout.email,
    name: payout.name,
    role_title: payout.role_title || "",
    location: "",
    employee_type: payout.employee_type,
    token: payout.token,
    network: payout.network,
    amount_minor: payout.amount_minor,
    endpoint: payout.endpoint,
    status: payout.status,
    payout_verified_at: payout.payout_verified_at,
    last_paid_at: payout.last_paid_at,
    created_at: payout.created_at,
    payment_cadence: payout.payment_cadence,
    payment_date_key: payout.payment_date_key,
    nextPayday: payout.nextPayday,
    nextPaydayDisplay: payout.nextPaydayDisplay,
    avatar_url: payout.avatar_url ?? null,
  };
}

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
