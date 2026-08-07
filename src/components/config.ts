/** Payroll payment UI constants */

export const PAYMENT_MODES = {
  DRY_RUN: "dry-run",
  LIVE: "live",
} as const;

export type PaymentUiMode = (typeof PAYMENT_MODES)[keyof typeof PAYMENT_MODES];

export const PAYMENT_IDEMPOTENCY_PREFIX = "live";

/** Local wrangler cron rarely fires; poll /reconcile until 1Click settles. */
export const SETTLEMENT_POLL_ROUNDS = 20;
export const SETTLEMENT_POLL_INTERVAL_MS = 3_000;

export const PAYMENT_ITEM_PROGRESS_LABELS = {
  queued: "Queued",
  quoting: "Requesting confidential quote",
  signing: "Awaiting wallet signature",
  submitting: "Submitting intent",
  submitted: "Submitted",
  settling: "Waiting for settlement",
  confirmed: "Paid",
  failed: "Failed",
} as const;

export type PaymentItemProgressStatus = keyof typeof PAYMENT_ITEM_PROGRESS_LABELS;
