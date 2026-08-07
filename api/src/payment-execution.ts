import { checkSwapStatus, verifyOneClickQuote, type QuoteRequest } from "./intents";
import {
  executionGate,
  isDefinitiveSubmitFailure,
  itemStatusForAttempt,
  mapProviderStatus,
  quoteRequestDeadlinePassed,
  syncPayrollRunStatus,
  type PaymentAttemptState,
} from "./payment-state";
import { nowIso, uuid } from "./types";
import type { Env } from "./types";

export interface PaymentAttemptRow {
  id: string;
  org_id: string;
  run_id: string;
  item_id: string;
  idempotency_key: string;
  state: PaymentAttemptState;
  token: string;
  network: string;
  amount_minor: number;
  recipient: string;
  signer_id: string;
  deposit_address: string | null;
  deposit_memo: string | null;
  quote_request: string | null;
  quote_response: string | null;
  quote_hash: string | null;
  intent_payload: string | null;
  intent_hash: string | null;
  provider_status: string | null;
  reconcile_failures: number;
  [key: string]: unknown;
}

export async function getPaymentAttempt(db: D1Database, attemptId: string, orgId?: string | null): Promise<PaymentAttemptRow | null> {
  const query = orgId
    ? "SELECT * FROM payment_attempts WHERE id = ? AND org_id = ?"
    : "SELECT * FROM payment_attempts WHERE id = ?";
  const values = orgId ? [attemptId, orgId] : [attemptId];
  return db.prepare(query).bind(...values).first<PaymentAttemptRow>();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 1000) : "Unknown reconciliation error";
}

function nextReconcileAt(failures: number): string {
  const delaySeconds = Math.min(15 * 60, 30 * 2 ** Math.min(failures, 5));
  return new Date(Date.now() + delaySeconds * 1000).toISOString();
}

/** Mark attempt failed and reopen the payroll item so a fresh quote can be created. */
export async function failAttemptAndReopenItem(
  env: Env,
  attempt: PaymentAttemptRow,
  error: string,
  actorId?: string | null,
): Promise<PaymentAttemptRow> {
  const timestamp = nowIso();
  const detail = error.slice(0, 1000);
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE payment_attempts
       SET state = 'failed', provider_status = 'FAILED', last_error = ?, failed_at = ?,
           next_reconcile_at = NULL, updated_at = ?
       WHERE id = ? AND state IN ('submitting', 'submitted', 'processing', 'awaiting_signature', 'quoted', 'generating')`,
    ).bind(detail, timestamp, timestamp, attempt.id),
    env.DB.prepare(
      `UPDATE payrun_items
       SET status = 'pending', deposit_address = NULL, intent_hash = NULL,
           signed_at = NULL, submitted_at = NULL, confirmed_at = NULL, error = ?
       WHERE id = ?`,
    ).bind(detail, attempt.item_id),
    env.DB.prepare(
      `UPDATE chain_records
       SET status = 'failed', provider_status = 'FAILED', error = ?, confirmed_at = NULL
       WHERE attempt_id = ?`,
    ).bind(detail, attempt.id),
    env.DB.prepare(
      "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'payment.failed', ?)",
    ).bind(uuid(), attempt.org_id, actorId || null, `Failed payment attempt ${attempt.id}: ${detail.slice(0, 200)}`),
  ]);
  await syncPayrollRunStatus(env.DB, attempt.run_id);
  const updated = await getPaymentAttempt(env.DB, attempt.id);
  if (!updated) throw new Error("Payment attempt disappeared while failing");
  return updated;
}

function shouldFailUnsubmittedExpiredAttempt(attempt: PaymentAttemptRow): string | null {
  if (attempt.intent_hash) return null;
  if (!["submitting", "processing"].includes(attempt.state)) return null;
  const lastError = String(attempt.last_error || "");
  if (isDefinitiveSubmitFailure(lastError)) {
    return lastError || "Quote has expired";
  }
  // Intent never accepted: reopen once the quote request deadline has passed,
  // even if reconcile cleared last_error after a PENDING_DEPOSIT status poll.
  if (quoteRequestDeadlinePassed(attempt.quote_request)) {
    return "Quote request deadline passed before the intent was accepted; reopen for a new quote";
  }
  return null;
}

export async function reconcilePaymentAttempt(env: Env, attempt: PaymentAttemptRow, options: { force?: boolean } = {}): Promise<PaymentAttemptRow> {
  if (!attempt.deposit_address) throw new Error("Payment attempt has no deposit address");
  if (!["submitting", "submitted", "processing"].includes(attempt.state)) {
    throw new Error(`Payment attempt in state ${attempt.state} cannot be reconciled`);
  }

  const expiredFailure = shouldFailUnsubmittedExpiredAttempt(attempt);
  if (expiredFailure) {
    return failAttemptAndReopenItem(env, attempt, expiredFailure);
  }

  if (!options.force) {
    const now = nowIso();
    const lockUntil = new Date(Date.now() + 60_000).toISOString();
    const claimed = await env.DB.prepare(
      `UPDATE payment_attempts SET next_reconcile_at = ?, updated_at = ?
       WHERE id = ? AND (next_reconcile_at IS NULL OR next_reconcile_at <= ?)`,
    ).bind(lockUntil, now, attempt.id, now).run();
    if (Number(claimed.meta.changes || 0) !== 1) {
      const unchanged = await getPaymentAttempt(env.DB, attempt.id);
      if (!unchanged) throw new Error("Payment attempt disappeared before reconciliation");
      return unchanged;
    }
  }

  try {
    const provider = await checkSwapStatus(env, attempt.deposit_address, attempt.deposit_memo || undefined);
    if (!attempt.quote_request || !attempt.quote_hash) throw new Error("Payment attempt is missing its verified quote evidence");
    const quoteRequest = JSON.parse(attempt.quote_request) as QuoteRequest;
    const statusQuoteHash = verifyOneClickQuote(env, quoteRequest, provider.quoteResponse);
    if (statusQuoteHash !== attempt.quote_hash) throw new Error("1Click status quote does not match the stored payment quote");
    if (provider.quoteResponse.quote.depositAddress !== attempt.deposit_address) {
      throw new Error("1Click status quote deposit address does not match the payment attempt");
    }
    if (String(provider.quoteResponse.quote.depositMemo || "") !== String(attempt.deposit_memo || "")) {
      throw new Error("1Click status quote deposit memo does not match the payment attempt");
    }
    const state = mapProviderStatus(provider.status);
    if (!state) throw new Error(`Unsupported provider status: ${provider.status}`);
    const timestamp = nowIso();
    const providerIntentHash = provider.swapDetails?.intentHashes?.[0] || attempt.intent_hash;
    const terminalAt = state === "confirmed" || state === "failed" || state === "refunded" ? timestamp : null;
    const nextCheck = state === "processing" ? new Date(Date.now() + 30_000).toISOString() : null;
    // Failed/refunded attempts reopen the payroll item as pending so a new quote can be created.
    const reopenItem = state === "failed" || state === "refunded";
    const itemStatus = reopenItem ? "pending" : itemStatusForAttempt(state);
    const itemUpdate = reopenItem
      ? env.DB.prepare(
        `UPDATE payrun_items
         SET status = 'pending', deposit_address = NULL, intent_hash = NULL,
             signed_at = NULL, submitted_at = NULL, confirmed_at = NULL, error = ?
         WHERE id = ?`,
      ).bind(provider.status, attempt.item_id)
      : env.DB.prepare(
        `UPDATE payrun_items
         SET status = ?, intent_hash = COALESCE(?, intent_hash),
             confirmed_at = CASE WHEN ? = 'paid' THEN ? ELSE confirmed_at END,
             error = NULL
         WHERE id = ?`,
      ).bind(itemStatus, providerIntentHash || null, itemStatus, timestamp, attempt.item_id);

    await env.DB.batch([
      env.DB.prepare(
        `UPDATE payment_attempts
         SET state = ?, provider_status = ?, provider_response = ?, intent_hash = ?,
             last_error = NULL, reconcile_failures = 0, last_reconciled_at = ?,
             next_reconcile_at = ?, updated_at = ?,
             confirmed_at = CASE WHEN ? = 'confirmed' THEN ? ELSE confirmed_at END,
             failed_at = CASE WHEN ? = 'failed' THEN ? ELSE failed_at END,
             refunded_at = CASE WHEN ? = 'refunded' THEN ? ELSE refunded_at END
         WHERE id = ?`,
      ).bind(
        state,
        provider.status,
        JSON.stringify(provider),
        providerIntentHash || null,
        timestamp,
        nextCheck,
        timestamp,
        state,
        terminalAt,
        state,
        terminalAt,
        state,
        terminalAt,
        attempt.id,
      ),
      itemUpdate,
      env.DB.prepare(
        `UPDATE chain_records
         SET status = ?, intent_hash = COALESCE(?, intent_hash), provider_status = ?,
             confirmed_at = CASE WHEN ? = 'confirmed' THEN ? ELSE confirmed_at END,
             error = CASE WHEN ? IN ('failed', 'refunded') THEN ? ELSE NULL END
         WHERE attempt_id = ?`,
      ).bind(state, providerIntentHash || null, provider.status, state, terminalAt, state, provider.status, attempt.id),
      env.DB.prepare(
        `UPDATE employees
         SET last_paid_at = ?,
             amount_minor = COALESCE((SELECT amount_minor FROM payrun_items WHERE id = ?), amount_minor)
         WHERE ? = 'confirmed' AND id = (SELECT employee_id FROM payrun_items WHERE id = ?)`,
      ).bind(timestamp, attempt.item_id, state, attempt.item_id),
    ]);
    await syncPayrollRunStatus(env.DB, attempt.run_id);
  } catch (error) {
    const failures = Number(attempt.reconcile_failures || 0) + 1;
    const timestamp = nowIso();
    await env.DB.prepare(
      `UPDATE payment_attempts
       SET last_error = ?, reconcile_failures = ?, last_reconciled_at = ?,
           next_reconcile_at = ?, updated_at = ?
       WHERE id = ?`,
    ).bind(errorMessage(error), failures, timestamp, nextReconcileAt(failures), timestamp, attempt.id).run();
  }

  const updated = await getPaymentAttempt(env.DB, attempt.id);
  if (!updated) throw new Error("Payment attempt disappeared during reconciliation");
  return updated;
}

export async function reconcileOpenPayments(env: Env, limit = 1): Promise<{ checked: number; attempts: PaymentAttemptRow[] }> {
  if (!executionGate(env).allowed || !env.INTENTS_API_KEY) return { checked: 0, attempts: [] };
  const due = await env.DB.prepare(
    `SELECT * FROM payment_attempts
     WHERE state IN ('submitting', 'submitted', 'processing')
       AND (next_reconcile_at IS NULL OR next_reconcile_at <= ?)
     ORDER BY COALESCE(next_reconcile_at, updated_at) ASC
     LIMIT ?`,
  ).bind(nowIso(), Math.max(1, Math.min(limit, 10))).all<PaymentAttemptRow>();
  const attempts: PaymentAttemptRow[] = [];
  for (const attempt of due.results) {
    attempts.push(await reconcilePaymentAttempt(env, attempt));
  }
  return { checked: attempts.length, attempts };
}
