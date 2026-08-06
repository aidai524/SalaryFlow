import { checkSwapStatus, verifyOneClickQuote, type QuoteRequest } from "./intents";
import { executionGate, itemStatusForAttempt, mapProviderStatus, syncPayrollRunStatus, type PaymentAttemptState } from "./payment-state";
import { nowIso } from "./types";
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

export async function reconcilePaymentAttempt(env: Env, attempt: PaymentAttemptRow, options: { force?: boolean } = {}): Promise<PaymentAttemptRow> {
  if (!attempt.deposit_address) throw new Error("Payment attempt has no deposit address");
  if (!["submitting", "submitted", "processing"].includes(attempt.state)) {
    throw new Error(`Payment attempt in state ${attempt.state} cannot be reconciled`);
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
    const itemStatus = itemStatusForAttempt(state);
    const providerIntentHash = provider.swapDetails?.intentHashes?.[0] || attempt.intent_hash;
    const terminalAt = state === "confirmed" || state === "failed" || state === "refunded" ? timestamp : null;
    const nextCheck = state === "processing" ? new Date(Date.now() + 30_000).toISOString() : null;

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
      env.DB.prepare(
        `UPDATE payrun_items
         SET status = ?, intent_hash = COALESCE(?, intent_hash),
             confirmed_at = CASE WHEN ? = 'paid' THEN ? ELSE confirmed_at END,
             error = CASE WHEN ? IN ('failed', 'refunded') THEN ? ELSE NULL END
         WHERE id = ?`,
      ).bind(itemStatus, providerIntentHash || null, itemStatus, timestamp, itemStatus, provider.status, attempt.item_id),
      env.DB.prepare(
        `UPDATE chain_records
         SET status = ?, intent_hash = COALESCE(?, intent_hash), provider_status = ?,
             confirmed_at = CASE WHEN ? = 'confirmed' THEN ? ELSE confirmed_at END,
             error = CASE WHEN ? IN ('failed', 'refunded') THEN ? ELSE NULL END
         WHERE attempt_id = ?`,
      ).bind(state, providerIntentHash || null, provider.status, state, timestamp, state, provider.status, attempt.id),
      env.DB.prepare(
        `UPDATE employees SET last_paid_at = ?
         WHERE ? = 'confirmed' AND id = (SELECT employee_id FROM payrun_items WHERE id = ?)`,
      ).bind(timestamp, state, attempt.item_id),
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
