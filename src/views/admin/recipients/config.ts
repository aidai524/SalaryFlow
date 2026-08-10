import type {
  ContractorPaymentCadence,
  EmployeeType,
  RecipientRoleTitle,
} from "@/lib/api";
import {
  MONTHLY_PAYMENT_DATE_OPTIONS,
  WEEKLY_PAYMENT_DATE_OPTIONS,
} from "@/views/admin/create-team/config";

export { MONTHLY_PAYMENT_DATE_OPTIONS, WEEKLY_PAYMENT_DATE_OPTIONS };

export const PAGE_SIZE = 10;

export const ROLE_OPTIONS: Array<{ value: RecipientRoleTitle; label: string }> = [
  { value: "Developer", label: "Developer" },
  { value: "Product", label: "Product" },
  { value: "Growth", label: "Growth" },
  { value: "Finance", label: "Finance" },
  { value: "Operations", label: "Operations" },
];

export type TypeFilter = "all" | EmployeeType;

export const TYPE_FILTERS: Array<{ value: TypeFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "employee", label: "Employees" },
  { value: "contractor", label: "Contractors" },
];

export const CONTRACTOR_SCHEDULE_OPTIONS: Array<{
  value: ContractorPaymentCadence;
  label: string;
}> = [
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "on_demand", label: "On Demand" },
];

export const TOKEN_OPTIONS = ["USDC", "USDT"] as const;
