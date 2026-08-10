// Recipient role / type / contractor cadence helpers (Recipients page).

import {
  isPaymentDateValidForSchedule,
  normalizeTeamPaymentDateKey,
  normalizeTeamPaymentSchedule,
  type TeamPaymentDateKey,
  type TeamPaymentSchedule,
} from "./org-payment";

export const RECIPIENT_ROLE_TITLES = [
  "Developer",
  "Product",
  "Growth",
  "Finance",
  "Operations",
] as const;

export type RecipientRoleTitle = (typeof RECIPIENT_ROLE_TITLES)[number];

export type EmployeeType = "employee" | "contractor";

/** Contractor-only schedule; employees always inherit the team schedule. */
export type ContractorPaymentCadence = TeamPaymentSchedule | "on_demand";

const ROLE_SET = new Set<string>(RECIPIENT_ROLE_TITLES);
const TYPE_SET = new Set<EmployeeType>(["employee", "contractor"]);
const CONTRACTOR_CADENCE_SET = new Set<ContractorPaymentCadence>(["monthly", "weekly", "on_demand"]);

export function normalizeEmployeeType(value: unknown): EmployeeType | null {
  const t = String(value || "").trim().toLowerCase() as EmployeeType;
  return TYPE_SET.has(t) ? t : null;
}

export function normalizeRoleTitle(value: unknown): RecipientRoleTitle | "" | null {
  if (value === undefined || value === null) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  return ROLE_SET.has(raw) ? (raw as RecipientRoleTitle) : null;
}

export function normalizeContractorCadence(value: unknown): ContractorPaymentCadence | null {
  const c = String(value || "").trim().toLowerCase() as ContractorPaymentCadence;
  return CONTRACTOR_CADENCE_SET.has(c) ? c : null;
}

export interface ResolvedRecipientSchedule {
  cadence: TeamPaymentSchedule | "on_demand";
  dateKey: TeamPaymentDateKey | null;
  /** False when on_demand — skip payStatus / next payday. */
  scheduled: boolean;
}

/**
 * Resolve the effective pay schedule for an employee row.
 * Full-time employees always use the team schedule.
 */
export function resolveRecipientSchedule(opts: {
  employeeType: EmployeeType;
  teamCadence: TeamPaymentSchedule | null;
  teamDateKey: TeamPaymentDateKey | null;
  paymentCadence: string | null | undefined;
  paymentDateKey: string | null | undefined;
}): ResolvedRecipientSchedule | null {
  if (opts.employeeType === "employee") {
    if (!opts.teamCadence || !opts.teamDateKey) return null;
    return { cadence: opts.teamCadence, dateKey: opts.teamDateKey, scheduled: true };
  }

  const cadence = normalizeContractorCadence(opts.paymentCadence);
  if (!cadence) {
    // Legacy contractors without cadence → treat as on_demand.
    return { cadence: "on_demand", dateKey: null, scheduled: false };
  }
  if (cadence === "on_demand") {
    return { cadence: "on_demand", dateKey: null, scheduled: false };
  }
  const dateKey = normalizeTeamPaymentDateKey(opts.paymentDateKey);
  if (!dateKey || !isPaymentDateValidForSchedule(cadence, dateKey)) return null;
  return { cadence, dateKey, scheduled: true };
}

/** Validate contractor cadence + date payload for create/update. */
export function parseContractorScheduleInput(body: {
  payment_cadence?: unknown;
  payment_date_key?: unknown;
  paymentCadence?: unknown;
  paymentDate?: unknown;
}): { ok: true; cadence: ContractorPaymentCadence; dateKey: TeamPaymentDateKey | null } | { ok: false; error: string } {
  const rawCadence = body.payment_cadence ?? body.paymentCadence;
  const cadence = normalizeContractorCadence(rawCadence);
  if (!cadence) return { ok: false, error: "Choose a valid payment schedule for contractors" };
  if (cadence === "on_demand") {
    return { ok: true, cadence, dateKey: null };
  }
  const rawDate = body.payment_date_key ?? body.paymentDate;
  const dateKey = normalizeTeamPaymentDateKey(rawDate);
  if (!dateKey) return { ok: false, error: "Choose a valid payment date" };
  if (!isPaymentDateValidForSchedule(cadence, dateKey)) {
    return { ok: false, error: "Payment date does not match the selected schedule" };
  }
  return { ok: true, cadence, dateKey };
}

export { normalizeTeamPaymentSchedule, normalizeTeamPaymentDateKey };
