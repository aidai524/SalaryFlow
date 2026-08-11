import { encodeErc191Signature } from "./erc191";
import {
  checkSwapStatus,
  submitIntent,
  verifyOneClickStatusQuote,
  type QuoteRequest,
} from "./intents";
import {
  employeePaymentStatusForAttempt,
  executionGate,
  FUNDING_RECONCILE_STATES,
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
  run_id: string | null;
  item_id: string | null;
  employee_payment_id: string | null;
  idempotency_key: string;
  flow: "standard" | "private";
  state: PaymentAttemptState;
  token: string;
  network: string;
  amount_minor: number;
  recipient: string;
  signer_id: string;
  origin_asset_id: string | null;
  destination_asset_id: string | null;
  deposit_address: string | null;
  deposit_memo: string | null;
  deposit_tx_hash: string | null;
  quote_request: string | null;
  quote_response: string | null;
  quote_hash: string | null;
  intent_payload: string | null;
  intent_signature: string | null;
  intent_hash: string | null;
  funding_deposit_address: string | null;
  funding_deposit_memo: string | null;
  funding_tx_hash: string | null;
  funding_quote_request: string | null;
  funding_quote_response: string | null;
  funding_quote_hash: string | null;
  funding_expires_at: string | null;
  destination_tx_hash: string | null;
  destination_tx_explorer_url: string | null;
  provider_status: string | null;
  reconcile_failures: number;
  [key: string]: unknown;
}

function destinationTxFromProvider(provider: {
  swapDetails?: {
    destinationChainTxHashes?: Array<{ hash?: string; explorerUrl?: string }>;
  };
}): { hash: string | null; explorerUrl: string | null } {
  const dest = provider.swapDetails?.destinationChainTxHashes?.[0];
  const hash = typeof dest?.hash === "string" && dest.hash.trim() ? dest.hash.trim() : null;
  const explorerUrl =
    typeof dest?.explorerUrl === "string" && dest.explorerUrl.trim()
      ? dest.explorerUrl.trim()
      : null;
  return { hash, explorerUrl };
}

const RECONCILE_STATES = [
  "submitting",
  "submitted",
  "awaiting_deposit",
  "deposit_submitted",
  "funding_quoted",
  "funding_deposit_submitted",
  "funding_processing",
  "processing",
] as const;

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

/** Mark attempt failed and reopen the payroll item / employee payment so a fresh quote can be created. */
export async function failAttemptAndReopenItem(
  env: Env,
  attempt: PaymentAttemptRow,
  error: string,
  actorId?: string | null,
): Promise<PaymentAttemptRow> {
  const timestamp = nowIso();
  const detail = error.slice(0, 1000);
  const statements = [
    env.DB.prepare(
      `UPDATE payment_attempts
       SET state = 'failed', provider_status = 'FAILED', last_error = ?, failed_at = ?,
           next_reconcile_at = NULL, updated_at = ?
       WHERE id = ? AND state IN (
         'submitting', 'submitted', 'processing', 'awaiting_signature', 'quoted',
         'generating', 'awaiting_deposit', 'deposit_submitted',
         'funding_quoted', 'funding_deposit_submitted', 'funding_processing'
       )`,
    ).bind(detail, timestamp, timestamp, attempt.id),
    env.DB.prepare(
      `UPDATE chain_records
       SET status = 'failed', provider_status = 'FAILED', error = ?, confirmed_at = NULL
       WHERE attempt_id = ?`,
    ).bind(detail, attempt.id),
    env.DB.prepare(
      "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'payment.failed', ?)",
    ).bind(uuid(), attempt.org_id, actorId || null, `Failed payment attempt ${attempt.id}: ${detail.slice(0, 200)}`),
  ];

  if (attempt.item_id) {
    statements.push(
      env.DB.prepare(
        `UPDATE payrun_items
         SET status = 'pending', deposit_address = NULL, intent_hash = NULL,
             signed_at = NULL, submitted_at = NULL, confirmed_at = NULL, error = ?
         WHERE id = ?`,
      ).bind(detail, attempt.item_id),
    );
  }
  if (attempt.employee_payment_id) {
    statements.push(
      env.DB.prepare(
        `UPDATE employee_payments
         SET status = 'pending', paid_at = NULL, updated_at = ?
         WHERE id = ?`,
      ).bind(timestamp, attempt.employee_payment_id),
    );
  }

  await env.DB.batch(statements);
  if (attempt.run_id) await syncPayrollRunStatus(env.DB, attempt.run_id);
  const updated = await getPaymentAttempt(env.DB, attempt.id);
  if (!updated) throw new Error("Payment attempt disappeared while failing");
  return updated;
}

function shouldFailUnsubmittedExpiredAttempt(attempt: PaymentAttemptRow): string | null {
  // ORIGIN_CHAIN deposits: fail if still awaiting deposit past quote deadline.
  if (["awaiting_deposit", "quoted"].includes(attempt.state) && quoteRequestDeadlinePassed(attempt.quote_request)) {
    return "Quote request deadline passed before deposit; reopen for a new quote";
  }
  // Private funding deposit never sent before funding quote expired.
  if (
    attempt.state === "funding_quoted"
    && quoteRequestDeadlinePassed(attempt.funding_quote_request)
  ) {
    return "Funding quote deadline passed before deposit; reopen for a new quote";
  }
  if (attempt.intent_hash) return null;

  // Once a deposit tx is known (standard Quick Pay / private funding), keep
  // polling 1Click. The quote-request deadline (~10m) only gates initiating the
  // deposit; settlement uses quote.deadline / timeWhenInactive (often days).
  // Previously, processing + missing intent_hash after that window incorrectly
  // failed live swaps that were still PROCESSING at the provider.
  if (
    attempt.deposit_tx_hash
    || attempt.funding_tx_hash
    || attempt.state === "deposit_submitted"
    || attempt.state === "funding_deposit_submitted"
    || attempt.state === "funding_processing"
    || attempt.state === "processing"
  ) {
    return null;
  }

  // Legacy intent-submit path: still waiting for 1Click to accept the signed intent.
  if (attempt.state !== "submitting") return null;
  const lastError = String(attempt.last_error || "");
  if (isDefinitiveSubmitFailure(lastError)) {
    return lastError || "Quote has expired";
  }
  if (quoteRequestDeadlinePassed(attempt.quote_request)) {
    return "Quote request deadline passed before the intent was accepted; reopen for a new quote";
  }
  return null;
}

function intentPayloadDeadlinePassed(intentPayloadJson: string | null | undefined): boolean {
  if (!intentPayloadJson) return false;
  try {
    const intent = JSON.parse(intentPayloadJson) as { payload?: unknown };
    const payload = typeof intent.payload === "string"
      ? JSON.parse(intent.payload) as { deadline?: string }
      : null;
    const deadline = Date.parse(String(payload?.deadline || ""));
    return Number.isFinite(deadline) && deadline <= Date.now();
  } catch {
    return false;
  }
}

/** Poll funding (leg A) status; on SUCCESS submit the pre-signed private intent (leg B). */
async function reconcileFundingLeg(
  env: Env,
  attempt: PaymentAttemptRow,
): Promise<PaymentAttemptRow> {
  if (!attempt.funding_deposit_address) {
    throw new Error("Private payment attempt has no funding deposit address");
  }
  if (!attempt.funding_quote_request || !attempt.funding_quote_hash) {
    throw new Error("Private payment attempt is missing funding quote evidence");
  }
  if (!attempt.intent_payload || !attempt.intent_signature) {
    throw new Error("Private payment attempt is missing a pre-signed intent");
  }

  const provider = await checkSwapStatus(
    env,
    attempt.funding_deposit_address,
    attempt.funding_deposit_memo || undefined,
  );
  const fundingRequest = JSON.parse(attempt.funding_quote_request) as QuoteRequest;
  verifyOneClickStatusQuote(
    env,
    fundingRequest,
    provider.quoteResponse,
    String(attempt.funding_quote_hash),
  );
  if (provider.quoteResponse.quote.depositAddress !== attempt.funding_deposit_address) {
    throw new Error("1Click funding status deposit address does not match the payment attempt");
  }

  const timestamp = nowIso();
  let fundingState = mapProviderStatus(provider.status);
  if (!fundingState) throw new Error(`Unsupported funding provider status: ${provider.status}`);

  // Keep funding_deposit_submitted until provider advances beyond PENDING_DEPOSIT.
  if (attempt.state === "funding_deposit_submitted" && fundingState === "awaiting_deposit") {
    fundingState = "funding_deposit_submitted";
  } else if (fundingState === "awaiting_deposit") {
    fundingState = attempt.state === "funding_quoted" ? "funding_quoted" : "funding_deposit_submitted";
  } else if (fundingState === "processing") {
    fundingState = "funding_processing";
  }

  if (fundingState === "failed" || fundingState === "refunded") {
    return failAttemptAndReopenItem(
      env,
      attempt,
      fundingState === "refunded"
        ? "Funding deposit was refunded to the source wallet"
        : "Confidential funding deposit failed",
    );
  }

  if (fundingState !== "confirmed") {
    const nextCheck = new Date(Date.now() + 30_000).toISOString();
    await env.DB.prepare(
      `UPDATE payment_attempts
       SET state = ?, provider_status = ?, provider_response = ?,
           last_error = NULL, reconcile_failures = 0, last_reconciled_at = ?,
           next_reconcile_at = ?, updated_at = ?
       WHERE id = ?`,
    ).bind(
      fundingState,
      provider.status,
      JSON.stringify(provider),
      timestamp,
      nextCheck,
      timestamp,
      attempt.id,
    ).run();
    const updated = await getPaymentAttempt(env.DB, attempt.id);
    if (!updated) throw new Error("Payment attempt disappeared during funding reconciliation");
    return updated;
  }

  // Funding SUCCESS — submit pre-signed intent for leg B.
  if (intentPayloadDeadlinePassed(attempt.intent_payload) || quoteRequestDeadlinePassed(attempt.quote_request)) {
    return failAttemptAndReopenItem(
      env,
      attempt,
      "Funds arrived in the confidential balance but the payout intent expired; funds remain in confidential intents and can be retried with a fresh signed payout",
    );
  }

  const intent = JSON.parse(attempt.intent_payload) as { standard?: string; payload?: unknown };
  if (intent.standard !== "erc191" || typeof intent.payload !== "string") {
    throw new Error("Stored private payment intent is invalid");
  }
  const providerSignature = encodeErc191Signature(attempt.intent_signature);
  let submitted: { intentHash: string; correlationId?: string };
  try {
    submitted = await submitIntent(env, {
      type: "swap_transfer",
      signedData: {
        standard: "erc191",
        payload: intent.payload,
        signature: providerSignature,
      },
    });
  } catch (error) {
    const detail = errorMessage(error);
    if (isDefinitiveSubmitFailure(detail)) {
      return failAttemptAndReopenItem(
        env,
        attempt,
        `Funds arrived in the confidential balance but payout submit failed (${detail}); funds remain in confidential intents and can be retried with a fresh signed payout`,
      );
    }
    throw error;
  }
  if (!submitted.intentHash) throw new Error("1Click did not return an intent hash after funding");

  const submittedAt = nowIso();
  const statements = [
    env.DB.prepare(
      `UPDATE payment_attempts
       SET state = 'submitted', intent_hash = ?, correlation_id = COALESCE(?, correlation_id),
           provider_status = 'SUBMITTED', submitted_at = ?, next_reconcile_at = ?,
           last_error = NULL, reconcile_failures = 0, last_reconciled_at = ?, updated_at = ?
       WHERE id = ? AND state IN ('funding_quoted', 'funding_deposit_submitted', 'funding_processing')`,
    ).bind(
      submitted.intentHash,
      submitted.correlationId || null,
      submittedAt,
      submittedAt,
      submittedAt,
      submittedAt,
      attempt.id,
    ),
    env.DB.prepare(
      `UPDATE chain_records
       SET status = 'submitted', intent_hash = ?, provider_status = 'SUBMITTED',
           signed_at = COALESCE(signed_at, ?), submitted_at = ?, error = NULL
       WHERE attempt_id = ?`,
    ).bind(submitted.intentHash, submittedAt, submittedAt, attempt.id),
    env.DB.prepare(
      "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'payment.submitted', ?)",
    ).bind(
      uuid(),
      attempt.org_id,
      null,
      `Auto-submitted private payout intent for attempt ${attempt.id} as ${submitted.intentHash}`,
    ),
  ];
  if (attempt.item_id) {
    statements.push(
      env.DB.prepare(
        "UPDATE payrun_items SET status = 'processing', intent_hash = ?, signed_at = COALESCE(signed_at, ?), submitted_at = ?, error = NULL WHERE id = ?",
      ).bind(submitted.intentHash, submittedAt, submittedAt, attempt.item_id),
    );
  }
  if (attempt.employee_payment_id) {
    statements.push(
      env.DB.prepare(
        `UPDATE employee_payments SET status = 'processing', updated_at = ? WHERE id = ?`,
      ).bind(submittedAt, attempt.employee_payment_id),
    );
  }
  await env.DB.batch(statements);

  const afterSubmit = await getPaymentAttempt(env.DB, attempt.id);
  if (!afterSubmit) throw new Error("Payment attempt disappeared after funding submit");
  // Immediately reconcile leg B once.
  return reconcilePaymentAttempt(env, afterSubmit, { force: true });
}

async function recordReconcileFailure(
  env: Env,
  attempt: PaymentAttemptRow,
  error: unknown,
): Promise<PaymentAttemptRow> {
  const failures = Number(attempt.reconcile_failures || 0) + 1;
  const timestamp = nowIso();
  await env.DB.prepare(
    `UPDATE payment_attempts
     SET last_error = ?, reconcile_failures = ?, last_reconciled_at = ?,
         next_reconcile_at = ?, updated_at = ?
     WHERE id = ?`,
  ).bind(errorMessage(error), failures, timestamp, nextReconcileAt(failures), timestamp, attempt.id).run();
  const updated = await getPaymentAttempt(env.DB, attempt.id);
  if (!updated) throw new Error("Payment attempt disappeared during reconciliation failure handling");
  return updated;
}

function claimedRows(result: D1Result): number {
  // Prefer meta.changes; some D1 responses only expose rows_written/changed_db.
  const meta = result.meta as {
    changes?: number;
    rows_written?: number;
    changed_db?: boolean;
  };
  if (typeof meta.changes === "number") return meta.changes;
  if (typeof meta.rows_written === "number") return meta.rows_written;
  return meta.changed_db ? 1 : 0;
}

export async function reconcilePaymentAttempt(env: Env, attempt: PaymentAttemptRow, options: { force?: boolean } = {}): Promise<PaymentAttemptRow> {
  if (!(RECONCILE_STATES as readonly string[]).includes(attempt.state)) {
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
    if (claimedRows(claimed) !== 1) {
      const unchanged = await getPaymentAttempt(env.DB, attempt.id);
      if (!unchanged) throw new Error("Payment attempt disappeared before reconciliation");
      return unchanged;
    }
  }

  if ((FUNDING_RECONCILE_STATES as readonly string[]).includes(attempt.state)) {
    try {
      return await reconcileFundingLeg(env, attempt);
    } catch (error) {
      return recordReconcileFailure(env, attempt, error);
    }
  }

  try {
    if (!attempt.deposit_address) throw new Error("Payment attempt has no deposit address");
    const provider = await checkSwapStatus(env, attempt.deposit_address, attempt.deposit_memo || undefined);
    if (!attempt.quote_request || !attempt.quote_hash) throw new Error("Payment attempt is missing its verified quote evidence");
    const quoteRequest = JSON.parse(attempt.quote_request) as QuoteRequest;
    verifyOneClickStatusQuote(env, quoteRequest, provider.quoteResponse, attempt.quote_hash);
    if (provider.quoteResponse.quote.depositAddress !== attempt.deposit_address) {
      throw new Error("1Click status quote deposit address does not match the payment attempt");
    }
    if (String(provider.quoteResponse.quote.depositMemo || "") !== String(attempt.deposit_memo || "")) {
      throw new Error("1Click status quote deposit memo does not match the payment attempt");
    }
    let state = mapProviderStatus(provider.status);
    if (!state) throw new Error(`Unsupported provider status: ${provider.status}`);
    // Keep deposit_submitted until provider advances beyond PENDING_DEPOSIT.
    if (attempt.state === "deposit_submitted" && state === "awaiting_deposit") {
      state = "deposit_submitted";
    }
    const timestamp = nowIso();
    const providerIntentHash = provider.swapDetails?.intentHashes?.[0] || attempt.intent_hash;
    const destinationTx = state === "confirmed" ? destinationTxFromProvider(provider) : { hash: null, explorerUrl: null };
    const terminalAt = state === "confirmed" || state === "failed" || state === "refunded" ? timestamp : null;
    const nextCheck = ["processing", "awaiting_deposit", "deposit_submitted"].includes(state)
      ? new Date(Date.now() + 30_000).toISOString()
      : null;
    const reopenItem = state === "failed" || state === "refunded";
    const statements = [
      env.DB.prepare(
        `UPDATE payment_attempts
         SET state = ?, provider_status = ?, provider_response = ?, intent_hash = ?,
             destination_tx_hash = COALESCE(?, destination_tx_hash),
             destination_tx_explorer_url = COALESCE(?, destination_tx_explorer_url),
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
        destinationTx.hash,
        destinationTx.explorerUrl,
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
        `UPDATE chain_records
         SET status = ?, intent_hash = COALESCE(?, intent_hash), provider_status = ?,
             confirmed_at = CASE WHEN ? = 'confirmed' THEN ? ELSE confirmed_at END,
             error = CASE WHEN ? IN ('failed', 'refunded') THEN ? ELSE NULL END
         WHERE attempt_id = ?`,
      ).bind(state, providerIntentHash || null, provider.status, state, terminalAt, state, provider.status, attempt.id),
    ];

    if (attempt.item_id) {
      const itemStatus = reopenItem ? "pending" : itemStatusForAttempt(state);
      statements.push(
        reopenItem
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
          ).bind(itemStatus, providerIntentHash || null, itemStatus, timestamp, attempt.item_id),
      );
      statements.push(
        env.DB.prepare(
          `UPDATE employees
           SET last_paid_at = ?,
               amount_minor = COALESCE((SELECT amount_minor FROM payrun_items WHERE id = ?), amount_minor)
           WHERE ? = 'confirmed' AND id = (SELECT employee_id FROM payrun_items WHERE id = ?)`,
        ).bind(timestamp, attempt.item_id, state, attempt.item_id),
      );
    }

    if (attempt.employee_payment_id) {
      const epStatus = reopenItem ? "pending" : employeePaymentStatusForAttempt(state);
      statements.push(
        env.DB.prepare(
          `UPDATE employee_payments
           SET status = ?, paid_at = CASE WHEN ? = 'paid' THEN ? ELSE paid_at END, updated_at = ?
           WHERE id = ?`,
        ).bind(epStatus, epStatus, timestamp, timestamp, attempt.employee_payment_id),
      );
      statements.push(
        env.DB.prepare(
          `UPDATE employees
           SET last_paid_at = ?
           WHERE ? = 'confirmed'
             AND id = (SELECT employee_id FROM employee_payments WHERE id = ?)`,
        ).bind(timestamp, state, attempt.employee_payment_id),
      );
    }

    await env.DB.batch(statements);
    if (attempt.run_id) await syncPayrollRunStatus(env.DB, attempt.run_id);
  } catch (error) {
    return recordReconcileFailure(env, attempt, error);
  }

  const updated = await getPaymentAttempt(env.DB, attempt.id);
  if (!updated) throw new Error("Payment attempt disappeared during reconciliation");
  return updated;
}

export async function reconcileOpenPayments(
  env: Env,
  limit = 1,
  options: { force?: boolean } = {},
): Promise<{ checked: number; attempts: PaymentAttemptRow[] }> {
  if (!executionGate(env).allowed || !env.INTENTS_API_KEY) return { checked: 0, attempts: [] };
  const cap = Math.max(1, Math.min(limit, 10));
  const due = options.force
    ? await env.DB.prepare(
      `SELECT * FROM payment_attempts
       WHERE state IN (
         'submitting', 'submitted', 'awaiting_deposit', 'deposit_submitted',
         'funding_quoted', 'funding_deposit_submitted', 'funding_processing',
         'processing'
       )
       ORDER BY COALESCE(next_reconcile_at, updated_at) ASC
       LIMIT ?`,
    ).bind(cap).all<PaymentAttemptRow>()
    : await env.DB.prepare(
      `SELECT * FROM payment_attempts
       WHERE state IN (
         'submitting', 'submitted', 'awaiting_deposit', 'deposit_submitted',
         'funding_quoted', 'funding_deposit_submitted', 'funding_processing',
         'processing'
       )
         AND (next_reconcile_at IS NULL OR next_reconcile_at <= ?)
       ORDER BY COALESCE(next_reconcile_at, updated_at) ASC
       LIMIT ?`,
    ).bind(nowIso(), cap).all<PaymentAttemptRow>();
  const attempts: PaymentAttemptRow[] = [];
  for (const attempt of due.results) {
    try {
      attempts.push(await reconcilePaymentAttempt(env, attempt, { force: options.force }));
    } catch (error) {
      // Keep batch reconcile alive when a single attempt hits an unexpected error.
      attempts.push(await recordReconcileFailure(env, attempt, error));
    }
  }
  return { checked: attempts.length, attempts };
}
