import type { TeamPaymentDateKey, TeamPaymentSchedule } from "@/lib/api";

export const DEFAULT_PAYMENT_SCHEDULE: TeamPaymentSchedule = "monthly";
export const DEFAULT_MONTHLY_PAYMENT_DATE: TeamPaymentDateKey = "every_1st";
export const DEFAULT_WEEKLY_PAYMENT_DATE: TeamPaymentDateKey = "every_monday";

export const PAYMENT_SCHEDULE_OPTIONS: Array<{
  value: TeamPaymentSchedule;
  label: string;
}> = [
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
];

export const MONTHLY_PAYMENT_DATE_OPTIONS: Array<{
  value: TeamPaymentDateKey;
  label: string;
}> = [
  { value: "every_1st", label: "Every 1st" },
  { value: "every_15th", label: "Every 15th" },
  { value: "every_end_of_month", label: "Every end of month" },
];

export const WEEKLY_PAYMENT_DATE_OPTIONS: Array<{
  value: TeamPaymentDateKey;
  label: string;
}> = [
  { value: "every_monday", label: "Every Monday" },
  { value: "every_tuesday", label: "Every Tuesday" },
  { value: "every_wednesday", label: "Every Wednesday" },
  { value: "every_thursday", label: "Every Thursday" },
  { value: "every_friday", label: "Every Friday" },
  { value: "every_saturday", label: "Every Saturday" },
  { value: "every_sunday", label: "Every Sunday" },
];

export const CREATE_TEAM_BG = "#C8E458";
