import { api, ApiError, type PayrunItem, type PaymentAttempt } from "@/lib/api";
import {
  PAYMENT_IDEMPOTENCY_PREFIX,
  SETTLEMENT_POLL_INTERVAL_MS,
  SETTLEMENT_POLL_ROUNDS,
} from "@/components/config";

const TERMINAL_ATTEMPT_STATES = new Set<PaymentAttempt["state"]>([
  "confirmed",
  "failed",
  "refunded",
]);

/** Attempts that already left pending and can continue without a new quote. */
export const RESUMABLE_PAYMENT_STATES = new Set<PaymentAttempt["state"]>([
  "quoted",
  "generating",
  "awaiting_signature",
]);

export function createPaymentIdempotencyKey(runId: string, itemId: string): string {
  const entropy = crypto.randomUUID().replaceAll("-", "");
  const key = `${PAYMENT_IDEMPOTENCY_PREFIX}:${runId.slice(0, 8)}:${itemId.slice(0, 8)}:${entropy}`;
  return key.slice(0, 128);
}

export function pendingPayableItems(items: PayrunItem[]): PayrunItem[] {
  return items.filter((item) => (
    (item.status === "pending" || item.status === "failed")
    && !!item.employee_id
  ));
}

/** Processing/submitting with no intent hash — usually expired submit / never accepted. */
export function stuckUnsubmittedAttempts(attempts: PaymentAttempt[]): PaymentAttempt[] {
  return attempts.filter((attempt) => (
    !attempt.intent_hash
    && (attempt.state === "processing" || attempt.state === "submitting")
  ));
}

/** Intent was accepted by 1Click; waiting for confidential settlement. */
export function inFlightSubmittedAttempts(attempts: PaymentAttempt[]): PaymentAttempt[] {
  return attempts.filter((attempt) => (
    !!attempt.intent_hash
    && (attempt.state === "processing" || attempt.state === "submitted" || attempt.state === "submitting")
  ));
}

export interface PayableWorkItem {
  itemId: string;
  employeeName: string;
  /** When set, resume this attempt instead of creating a new quote. */
  attemptId?: string;
}

/**
 * Build the live payment work queue:
 * - resume quoted / awaiting_signature attempts first
 * - then quote any still-pending linked items
 */
export function buildPayableWorkItems(
  items: PayrunItem[],
  attempts: PaymentAttempt[],
): PayableWorkItem[] {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const resumableByItem = new Map<string, PaymentAttempt>();

  for (const attempt of attempts) {
    if (!attempt.item_id) continue;
    if (!RESUMABLE_PAYMENT_STATES.has(attempt.state)) continue;
    const existing = resumableByItem.get(attempt.item_id);
    if (!existing || existing.created_at < attempt.created_at) {
      resumableByItem.set(attempt.item_id, attempt);
    }
  }

  const work: PayableWorkItem[] = [];
  for (const attempt of resumableByItem.values()) {
    if (!attempt.item_id) continue;
    const item = itemById.get(attempt.item_id);
    work.push({
      itemId: attempt.item_id,
      employeeName: item?.employee_name || attempt.recipient.slice(0, 10),
      attemptId: attempt.id,
    });
  }

  for (const item of pendingPayableItems(items)) {
    if (resumableByItem.has(item.id)) continue;
    work.push({
      itemId: item.id,
      employeeName: item.employee_name,
    });
  }

  return work;
}

/** Reconcile stuck unsubmitted attempts so the payroll item can return to pending. */
export async function reopenStuckPaymentAttempts(attempts: PaymentAttempt[]): Promise<number> {
  const stuck = stuckUnsubmittedAttempts(attempts);
  for (const attempt of stuck) {
    await api.reconcilePaymentAttempt(attempt.id);
  }
  return stuck.length;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll 1Click via reconcile until each attempt is terminal.
 * Needed locally because wrangler scheduled() rarely runs; also covers provider lag after submit.
 */
export async function pollSubmittedAttemptsUntilSettled(options: {
  attemptIds: string[];
  rounds?: number;
  intervalMs?: number;
  onRound?: (round: number, attempts: PaymentAttempt[]) => void;
}): Promise<PaymentAttempt[]> {
  const {
    attemptIds,
    rounds = SETTLEMENT_POLL_ROUNDS,
    intervalMs = SETTLEMENT_POLL_INTERVAL_MS,
    onRound,
  } = options;
  const uniqueIds = [...new Set(attemptIds.filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  let latest: PaymentAttempt[] = [];
  for (let round = 0; round < rounds; round += 1) {
    latest = [];
    for (const attemptId of uniqueIds) {
      const { attempt } = await api.reconcilePaymentAttempt(attemptId);
      latest.push(attempt);
    }
    onRound?.(round, latest);
    if (latest.every((attempt) => TERMINAL_ATTEMPT_STATES.has(attempt.state))) {
      return latest;
    }
    if (round < rounds - 1) await sleep(intervalMs);
  }
  return latest;
}

async function signAndSubmitAttempt(options: {
  attemptId: string;
  signMessage: (message: string) => Promise<string>;
  onPhase?: (phase: "quoting" | "signing" | "submitting" | "settling") => void;
}): Promise<PaymentAttempt> {
  const { attemptId, signMessage, onPhase } = options;
  onPhase?.("signing");
  const generated = await api.generatePaymentIntent(attemptId);
  let attempt = generated.attempt;
  const payload = generated.intent?.payload;
  if (typeof payload !== "string" || !payload) {
    throw new ApiError("Payment intent payload is missing", 503);
  }

  const signature = await signMessage(payload);
  onPhase?.("submitting");
  const submitted = await api.submitPaymentAttempt(attempt.id, signature);
  attempt = submitted.attempt;

  if (attempt.state === "failed") {
    throw new ApiError(attempt.last_error || "Payment submission was rejected", 409);
  }

  if (["submitted", "processing"].includes(attempt.state)) {
    onPhase?.("settling");
    try {
      const [settled] = await pollSubmittedAttemptsUntilSettled({ attemptIds: [attempt.id] });
      if (settled) attempt = settled;
    } catch {
      // Leave processing; admin can refresh settlement from the payroll page.
    }
  }

  return attempt;
}

export async function executeLivePaymentItem(options: {
  runId: string;
  itemId: string;
  attemptId?: string;
  signMessage: (message: string) => Promise<string>;
  onPhase?: (phase: "quoting" | "signing" | "submitting" | "settling") => void;
}): Promise<PaymentAttempt> {
  const { runId, itemId, attemptId, signMessage, onPhase } = options;

  if (attemptId) {
    return signAndSubmitAttempt({ attemptId, signMessage, onPhase });
  }

  onPhase?.("quoting");
  const quoted = await api.quotePaymentItem(itemId, createPaymentIdempotencyKey(runId, itemId));
  let attempt = quoted.attempt;

  if (["submitted", "processing", "confirmed"].includes(attempt.state)) {
    return attempt;
  }

  return signAndSubmitAttempt({
    attemptId: attempt.id,
    signMessage,
    onPhase,
  });
}
