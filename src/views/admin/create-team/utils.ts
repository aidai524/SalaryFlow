import type { TeamPaymentDateKey, TeamPaymentSchedule } from "@/lib/api";
import {
  DEFAULT_MONTHLY_PAYMENT_DATE,
  DEFAULT_WEEKLY_PAYMENT_DATE,
  MONTHLY_PAYMENT_DATE_OPTIONS,
  WEEKLY_PAYMENT_DATE_OPTIONS,
} from "./config";

export function paymentDateOptionsForSchedule(schedule: TeamPaymentSchedule) {
  return schedule === "monthly" ? MONTHLY_PAYMENT_DATE_OPTIONS : WEEKLY_PAYMENT_DATE_OPTIONS;
}

export function defaultPaymentDateForSchedule(schedule: TeamPaymentSchedule): TeamPaymentDateKey {
  return schedule === "monthly" ? DEFAULT_MONTHLY_PAYMENT_DATE : DEFAULT_WEEKLY_PAYMENT_DATE;
}
