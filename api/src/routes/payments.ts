// Payment preflight and stateful 1Click execution. External execution requires
// PAYMENTS_MODE=live plus an explicit environment acknowledgement; local
// defaults remain dry-run and cannot contact the provider.

import { Hono, type Context } from "hono";
import { verifyMessage, type Address, type Hex } from "viem";
import { findStableAsset, findStableAssetByNetwork, type StableSymbol } from "../assets";
import { encodeErc191Signature } from "../erc191";
import {
  generateIntent,
  getSupportedTokens,
  INTENTS_QUOTE_DEFAULTS,
  requestQuote,
  submitDepositTx,
  submitIntent,
  verifyOneClickQuote,
  type QuoteRequest,
} from "../intents";
import { toIntentsUserId } from "../intents-user-id";
import { parseTokenAmount } from "../money";
import { requireRole, type AppEnv } from "../middleware";
import {
  type TeamPaymentDateKey,
  type TeamPaymentSchedule,
} from "../org-payment";
import { resolveCurrentPeriod } from "../pay-period";
import { failAttemptAndReopenItem, getPaymentAttempt, reconcileOpenPayments, reconcilePaymentAttempt, type PaymentAttemptRow } from "../payment-execution";
import {
  executionGate,
  isDefinitiveSubmitFailure,
  resolveConfidentiality,
  resolvePaymentAssets,
  tokenMinorToAssetAmount,
  validatePaymentAssetMapping,
} from "../payment-state";
import { EVM_PAYOUT_NETWORKS, normalizePayoutAddress, PAYOUT_TOKENS } from "../payout";
import {
  QuickPayContextError,
  signQuickPayContext,
  verifyQuickPayContext,
  type QuickPayContextPayload,
} from "../quick-pay-context";
import { nowIso, uuid, type AuthUser } from "../types";

export const paymentRoutes = new Hono<AppEnv>();

const liveExecutionDisabled = {
  error: "Live payment execution is disabled; SalaryFlow currently supports local dry-run preflight only",
  code: "LIVE_PAYMENTS_DISABLED",
};

interface PayableItem extends Record<string, unknown> {
  id: string;
  run_id: string;
  employee_id: string | null;
  employee_name: string;
  amount_minor: number;
  token: string;
  network: string;
  status: string;
  org_id: string;
  payout_endpoint: string | null;
  employee_status: string | null;
  payout_token: string | null;
  payout_network: string | null;
  payout_verified_at: string | null;
}

type PaymentIssue = { itemId: string; employeeName: string; code: string; message: string };

function validatePayableItem(item: PayableItem): PaymentIssue[] {
  const issues: PaymentIssue[] = [];
  const add = (code: string, message: string) => issues.push({ itemId: String(item.id), employeeName: String(item.employee_name), code, message });
  if (!item.employee_id) add("UNLINKED_EMPLOYEE", "Payment must be linked to an employee profile");
  if (item.employee_status !== "ready") add("PAYOUT_NOT_READY", "Employee payout method is not verified");
  if (!item.payout_verified_at) add("PAYOUT_NOT_VERIFIED", "Employee wallet ownership has not been verified");
  if (!/^0x[a-fA-F0-9]{40}$/.test(String(item.payout_endpoint || ""))) add("INVALID_PAYOUT_ADDRESS", "A verified EVM payout address is required");
  if (item.token !== item.payout_token || item.network !== item.payout_network) add("PAYOUT_DETAILS_CHANGED", "Payroll token or network no longer matches the employee payout method");
  if (!PAYOUT_TOKENS.has(String(item.token))) add("UNSUPPORTED_TOKEN", "Only USDC and USDT are supported");
  if (!EVM_PAYOUT_NETWORKS.has(String(item.network))) add("UNSUPPORTED_NETWORK", "The payout network is not enabled");
  if (!Number.isSafeInteger(Number(item.amount_minor)) || Number(item.amount_minor) <= 0) add("INVALID_AMOUNT", "Amount must be a positive integer in token minor units");
  return issues;
}

async function loadPayableItem(db: D1Database, orgId: string | null, itemId: string): Promise<PayableItem | null> {
  return db.prepare(
    `SELECT pi.*, pr.org_id,
            e.endpoint AS payout_endpoint, e.status AS employee_status,
            e.token AS payout_token, e.network AS payout_network,
            e.payout_verified_at
     FROM payrun_items pi
     JOIN payroll_runs pr ON pr.id = pi.run_id
     LEFT JOIN employees e ON e.id = pi.employee_id AND e.org_id = pr.org_id
     WHERE pi.id = ? AND pr.org_id = ? AND pi.removed_at IS NULL AND pr.archived_at IS NULL`,
  ).bind(itemId, orgId).first<PayableItem>();
}

function providerError(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 1000) : "Unknown payment provider error";
}

function liveGateResponse(c: Context<AppEnv>) {
  const gate = executionGate(c.env);
  if (!gate.allowed) return c.json({ error: gate.message, code: gate.code }, gate.code === "LIVE_PAYMENTS_DISABLED" ? 409 : 503);
  if (!c.env.INTENTS_API_KEY) return c.json({ error: "INTENTS_API_KEY is required for live payments", code: "PAYMENT_PROVIDER_NOT_CONFIGURED" }, 503);
  return null;
}

// Local readiness validation. It never contacts 1Click or creates payment attempts.
paymentRoutes.post("/quote", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const body = await c.req.json().catch(() => null);
  const runId = String(body?.runId || "");

  if (!c.env.PAYMENTS_MODE || c.env.PAYMENTS_MODE === "disabled") {
    return c.json({ error: "Payment validation is disabled", code: "PAYMENTS_DISABLED" }, 503);
  }
  if (body?.dry !== true) return c.json(liveExecutionDisabled, 409);
  if (!runId) return c.json({ error: "runId is required" }, 400);
  const run = await c.env.DB.prepare("SELECT id FROM payroll_runs WHERE id = ? AND org_id = ? AND archived_at IS NULL").bind(runId, user.org_id).first<{ id: string }>();
  if (!run) return c.json({ error: "Run not found" }, 404);

  const items = await c.env.DB.prepare(
    `SELECT pi.*, pr.org_id,
            e.endpoint AS payout_endpoint, e.status AS employee_status,
            e.token AS payout_token, e.network AS payout_network,
            e.payout_verified_at
     FROM payrun_items pi
     JOIN payroll_runs pr ON pr.id = pi.run_id
     LEFT JOIN employees e ON e.id = pi.employee_id AND e.org_id = pr.org_id
     WHERE pi.run_id = ? AND pr.org_id = ? AND pi.status IN ('pending', 'failed')
       AND pi.removed_at IS NULL AND pr.archived_at IS NULL`,
  ).bind(runId, user.org_id).all<PayableItem>();
  if (items.results.length === 0) return c.json({ error: "No pending items in this run" }, 400);

  const issues = items.results.flatMap(validatePayableItem);
  if (issues.length > 0) {
    return c.json({
      error: `Dry-run validation failed: ${issues[0].employeeName} — ${issues[0].message}`,
      code: "DRY_RUN_VALIDATION_FAILED",
      issues,
      itemCount: items.results.length,
    }, 422);
  }

  const totals = items.results.reduce<{ usdc: number; usdt: number }>((sum, item) => {
    const token: "usdc" | "usdt" = item.token === "USDT" ? "usdt" : "usdc";
    sum[token] += Number(item.amount_minor);
    return sum;
  }, { usdc: 0, usdt: 0 });

  await c.env.DB.prepare(
    "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'payment.dry_run', ?)",
  ).bind(uuid(), user.org_id, user.id, `Validated ${items.results.length} pending items in run ${runId}`).run();

  return c.json({
    dry: true,
    mode: "dry-run",
    executionAllowed: false,
    itemCount: items.results.length,
    validatedItemCount: items.results.length,
    checkedAt: nowIso(),
    totals: { usdcMinor: totals.usdc, usdtMinor: totals.usdt },
  });
});

// Reserve an idempotent attempt and request one live quote for one payroll item.
paymentRoutes.post("/items/:itemId/quote", requireRole("admin"), async (c) => {
  const blocked = liveGateResponse(c);
  if (blocked) return blocked;
  const user = c.get("user") as AuthUser;
  if (!user.wallet_address) {
    return c.json({ error: "An admin payment wallet is required", code: "PAYMENT_WALLET_REQUIRED" }, 422);
  }
  const body = await c.req.json().catch(() => null);
  const idempotencyKey = String(body?.idempotencyKey || "").trim();
  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) {
    return c.json({ error: "idempotencyKey must be 16-128 safe characters" }, 400);
  }
  const itemId = c.req.param("itemId");
  const existing = await c.env.DB.prepare(
    "SELECT * FROM payment_attempts WHERE org_id = ? AND idempotency_key = ?",
  ).bind(user.org_id, idempotencyKey).first<PaymentAttemptRow>();
  if (existing) {
    if (existing.item_id !== itemId) return c.json({ error: "Idempotency key belongs to another payment item", code: "IDEMPOTENCY_KEY_CONFLICT" }, 409);
    return c.json({ attempt: existing, reused: true });
  }

  const item = await loadPayableItem(c.env.DB, user.org_id, itemId);
  if (!item) return c.json({ error: "Payment item not found" }, 404);
  if (item.status !== "pending" && item.status !== "failed") {
    return c.json({ error: "Only pending or failed payment items can be quoted", code: "ITEM_NOT_PENDING" }, 409);
  }
  const issues = validatePayableItem(item);
  if (issues.length > 0) return c.json({ error: issues[0].message, code: issues[0].code, issues }, 422);
  const assets = resolvePaymentAssets(c.env, item.token, item.network);
  if (!assets) return c.json({ error: `No live asset mapping for ${item.token} on ${item.network}`, code: "ASSET_MAP_MISSING" }, 503);
  let supportedTokens;
  try {
    supportedTokens = await getSupportedTokens(c.env);
  } catch (error) {
    return c.json({ error: "Could not validate the live asset mapping", code: "PAYMENT_PROVIDER_ERROR", detail: providerError(error) }, 503);
  }
  const assetIssue = validatePaymentAssetMapping(assets, item.token, item.network, supportedTokens);
  if (assetIssue) return c.json({ error: assetIssue.message, code: assetIssue.code }, 503);
  const providerAmount = tokenMinorToAssetAmount(Number(item.amount_minor), assets.destination.decimals);
  if (!providerAmount) {
    return c.json({ error: `Amount cannot be represented with ${assets.destination.decimals} destination decimals`, code: "AMOUNT_PRECISION_UNSUPPORTED" }, 422);
  }

  // CONFIDENTIAL_INTENTS refund/signer ids must be the Intents account id
  // (EVM → lowercased address), matching prophet/ui confidential withdraw quotes.
  let intentsAccountId: string;
  try {
    intentsAccountId = toIntentsUserId(user.wallet_address);
  } catch {
    return c.json({ error: "Payment wallet is not a valid EVM address", code: "PAYMENT_WALLET_INVALID" }, 422);
  }

  const timestamp = nowIso();
  const attemptId = uuid();
  const quoteRequest: QuoteRequest = {
    dry: false,
    swapType: "EXACT_OUTPUT",
    originAsset: assets.origin.assetId,
    depositType: "CONFIDENTIAL_INTENTS",
    destinationAsset: assets.destination.assetId,
    amount: providerAmount,
    recipient: String(item.payout_endpoint),
    recipientType: "DESTINATION_CHAIN",
    refundTo: intentsAccountId,
    refundType: "CONFIDENTIAL_INTENTS",
    confidentiality: "advanced",
    deadline: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    slippageTolerance: INTENTS_QUOTE_DEFAULTS.slippageTolerance,
  };
  const inserted = await c.env.DB.prepare(
    `INSERT OR IGNORE INTO payment_attempts
     (id, org_id, run_id, item_id, idempotency_key, state, token, network,
      amount_minor, recipient, signer_id, quote_request, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'created', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    attemptId,
    user.org_id,
    item.run_id,
    item.id,
    idempotencyKey,
    item.token,
    item.network,
    item.amount_minor,
    item.payout_endpoint,
    intentsAccountId,
    JSON.stringify(quoteRequest),
    user.id,
    timestamp,
    timestamp,
  ).run();
  if (Number(inserted.meta.changes || 0) !== 1) {
    const concurrent = await c.env.DB.prepare(
      "SELECT * FROM payment_attempts WHERE org_id = ? AND idempotency_key = ?",
    ).bind(user.org_id, idempotencyKey).first<PaymentAttemptRow>();
    if (concurrent) {
      if (concurrent.item_id !== itemId) return c.json({ error: "Idempotency key belongs to another payment item", code: "IDEMPOTENCY_KEY_CONFLICT" }, 409);
      return c.json({ attempt: concurrent, reused: true });
    }
    const active = await c.env.DB.prepare(
      `SELECT * FROM payment_attempts WHERE item_id = ?
       AND state IN ('created', 'quoting', 'quoted', 'generating', 'awaiting_signature', 'submitting', 'submitted', 'processing')
       ORDER BY created_at DESC LIMIT 1`,
    ).bind(item.id).first<PaymentAttemptRow>();
    return c.json({ error: "This payment item already has an active attempt", code: "ACTIVE_ATTEMPT_EXISTS", attempt: active }, 409);
  }
  await c.env.DB.prepare("UPDATE payment_attempts SET state = 'quoting', updated_at = ? WHERE id = ? AND state = 'created'")
    .bind(nowIso(), attemptId).run();

  try {
    const quote = await requestQuote(c.env, quoteRequest);
    const verifiedQuoteHash = verifyOneClickQuote(c.env, quoteRequest, quote);
    const depositAddress = quote.quote?.depositAddress;
    if (!depositAddress) throw new Error("1Click quote did not include a deposit address");
    if (!/^\d+$/.test(String(quote.quote.amountIn || "")) || BigInt(quote.quote.amountIn) <= 0n) {
      throw new Error("1Click quote input amount is invalid");
    }
    if (String(quote.quote.amountOut || "") !== providerAmount) {
      throw new Error("1Click exact-output quote does not match the payroll amount");
    }
    const quoteExpiresAt = String(quote.quote.deadline || "");
    if (!quoteExpiresAt || !Number.isFinite(Date.parse(quoteExpiresAt)) || Date.parse(quoteExpiresAt) <= Date.now()) {
      throw new Error("1Click quote is missing a valid future deadline");
    }
    const quotedAt = nowIso();
    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE payment_attempts
         SET state = 'quoted', quote_response = ?, quote_hash = ?, correlation_id = ?,
             deposit_address = ?, deposit_memo = ?, quote_expires_at = ?,
             last_error = NULL, updated_at = ? WHERE id = ? AND state = 'quoting'`,
      ).bind(
        JSON.stringify(quote),
        verifiedQuoteHash,
        quote.correlationId || null,
        depositAddress,
        quote.quote.depositMemo || null,
        quoteExpiresAt,
        quotedAt,
        attemptId,
      ),
      c.env.DB.prepare(
        `INSERT INTO chain_records
         (id, attempt_id, item_id, org_id, employee_name, token, network, amount_minor,
          origin_chain, dest_chain, confidentiality, status, quote_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confidential-intents', ?, 'advanced', 'quoted', ?)`,
      ).bind(uuid(), attemptId, item.id, user.org_id, item.employee_name, item.token, item.network, item.amount_minor, item.network, quotedAt),
      c.env.DB.prepare(
        `UPDATE payrun_items
         SET status = 'processing', deposit_address = ?, error = NULL,
             intent_hash = NULL, signed_at = NULL, submitted_at = NULL, confirmed_at = NULL
         WHERE id = ? AND status IN ('pending', 'failed')`,
      ).bind(depositAddress, item.id),
      c.env.DB.prepare("UPDATE payroll_runs SET status = 'processing', updated_at = ? WHERE id = ? AND org_id = ?")
        .bind(quotedAt, item.run_id, user.org_id),
      c.env.DB.prepare(
        "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'payment.quoted', ?)",
      ).bind(uuid(), user.org_id, user.id, `Quoted item ${item.id} as attempt ${attemptId}`),
    ]);
  } catch (error) {
    const failedAt = nowIso();
    await c.env.DB.prepare(
      "UPDATE payment_attempts SET state = 'failed', last_error = ?, failed_at = ?, updated_at = ? WHERE id = ?",
    ).bind(providerError(error), failedAt, failedAt, attemptId).run();
    return c.json({ error: "Live quote failed", code: "PAYMENT_PROVIDER_ERROR", detail: providerError(error) }, 503);
  }

  return c.json({ attempt: await getPaymentAttempt(c.env.DB, attemptId, user.org_id), reused: false }, 201);
});

paymentRoutes.post("/attempts/:attemptId/intent", requireRole("admin"), async (c) => {
  const blocked = liveGateResponse(c);
  if (blocked) return blocked;
  const user = c.get("user") as AuthUser;
  const attemptId = c.req.param("attemptId");
  let attempt = await getPaymentAttempt(c.env.DB, attemptId, user.org_id);
  if (!attempt) return c.json({ error: "Payment attempt not found" }, 404);
  if (!user.wallet_address || user.wallet_address.toLowerCase() !== attempt.signer_id.toLowerCase()) {
    return c.json({ error: "The payment wallet no longer matches this attempt", code: "PAYMENT_WALLET_CHANGED" }, 409);
  }
  if (attempt.intent_payload && ["awaiting_signature", "submitting", "submitted", "processing", "confirmed"].includes(attempt.state)) {
    return c.json({ attempt, intent: JSON.parse(attempt.intent_payload), reused: true });
  }
  if (attempt.state !== "quoted") return c.json({ error: `Cannot generate an intent from state ${attempt.state}` }, 409);
  if (attempt.quote_expires_at && new Date(String(attempt.quote_expires_at)).getTime() <= Date.now()) {
    return c.json({ error: "Payment quote has expired; create a new attempt", code: "QUOTE_EXPIRED" }, 409);
  }
  const claimed = await c.env.DB.prepare(
    "UPDATE payment_attempts SET state = 'generating', updated_at = ? WHERE id = ? AND state = 'quoted'",
  ).bind(nowIso(), attempt.id).run();
  if (Number(claimed.meta.changes || 0) !== 1) {
    attempt = await getPaymentAttempt(c.env.DB, attempt.id, user.org_id);
    return c.json({ error: "Payment attempt changed while generating the intent", code: "ATTEMPT_STATE_CONFLICT", attempt }, 409);
  }

  try {
    const signerId = toIntentsUserId(attempt.signer_id);
    const generated = await generateIntent(c.env, {
      type: "swap_transfer",
      standard: "erc191",
      signerId,
      depositAddress: String(attempt.deposit_address),
    });
    if (generated.intent.standard !== "erc191" || typeof generated.intent.payload !== "string") {
      throw new Error("1Click returned an unsupported intent payload");
    }
    const payload = JSON.parse(generated.intent.payload) as { signer_id?: string };
    if (String(payload.signer_id || "").toLowerCase() !== signerId) {
      throw new Error("1Click intent signer does not match the verified payment wallet");
    }
    const storedIntent = JSON.stringify(generated.intent);
    await c.env.DB.prepare(
      `UPDATE payment_attempts SET state = 'awaiting_signature', intent_payload = ?,
       correlation_id = COALESCE(?, correlation_id), last_error = NULL, updated_at = ?
       WHERE id = ? AND state = 'generating'`,
    ).bind(storedIntent, generated.correlationId || null, nowIso(), attempt.id).run();
  } catch (error) {
    await c.env.DB.prepare(
      "UPDATE payment_attempts SET state = 'quoted', last_error = ?, updated_at = ? WHERE id = ? AND state = 'generating'",
    ).bind(providerError(error), nowIso(), attempt.id).run();
    return c.json({ error: "Intent generation failed", code: "PAYMENT_PROVIDER_ERROR", detail: providerError(error) }, 503);
  }

  attempt = await getPaymentAttempt(c.env.DB, attempt.id, user.org_id);
  return c.json({ attempt, intent: attempt?.intent_payload ? JSON.parse(attempt.intent_payload) : null, reused: false });
});

paymentRoutes.post("/attempts/:attemptId/submit", requireRole("admin"), async (c) => {
  const blocked = liveGateResponse(c);
  if (blocked) return blocked;
  const user = c.get("user") as AuthUser;
  const attemptId = c.req.param("attemptId");
  let attempt = await getPaymentAttempt(c.env.DB, attemptId, user.org_id);
  if (!attempt) return c.json({ error: "Payment attempt not found" }, 404);
  if (["submitting", "submitted", "processing", "confirmed", "failed", "refunded"].includes(attempt.state)) {
    return c.json({ attempt, reused: true });
  }
  if (attempt.state !== "awaiting_signature" || !attempt.intent_payload) {
    return c.json({ error: `Cannot submit an attempt from state ${attempt.state}` }, 409);
  }
  if (!user.wallet_address || user.wallet_address.toLowerCase() !== attempt.signer_id.toLowerCase()) {
    return c.json({ error: "The payment wallet no longer matches this attempt", code: "PAYMENT_WALLET_CHANGED" }, 409);
  }
  const body = await c.req.json().catch(() => null);
  const signature = String(body?.signature || "");
  if (!/^0x[a-fA-F0-9]{130}$/.test(signature)) return c.json({ error: "A valid 65-byte EVM signature is required" }, 400);
  const intent = JSON.parse(attempt.intent_payload) as { standard?: string; payload?: unknown };
  if (intent.standard !== "erc191" || typeof intent.payload !== "string") return c.json({ error: "Stored payment intent is invalid" }, 500);
  let valid = false;
  try {
    valid = await verifyMessage({ address: attempt.signer_id as Address, message: intent.payload, signature: signature as Hex });
  } catch {
    valid = false;
  }
  if (!valid) return c.json({ error: "Payment signature does not match the verified admin wallet" }, 400);
  const providerSignature = encodeErc191Signature(signature);
  const claimed = await c.env.DB.prepare(
    "UPDATE payment_attempts SET state = 'submitting', updated_at = ? WHERE id = ? AND state = 'awaiting_signature'",
  ).bind(nowIso(), attempt.id).run();
  if (Number(claimed.meta.changes || 0) !== 1) return c.json({ error: "Payment attempt changed while submitting", code: "ATTEMPT_STATE_CONFLICT" }, 409);

  try {
    const submitted = await submitIntent(c.env, {
      type: "swap_transfer",
      signedData: { standard: "erc191", payload: intent.payload, signature: providerSignature },
    });
    if (!submitted.intentHash) throw new Error("1Click did not return an intent hash");
    const submittedAt = nowIso();
    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE payment_attempts
         SET state = 'submitted', intent_hash = ?, correlation_id = COALESCE(?, correlation_id),
             provider_status = 'SUBMITTED', submitted_at = ?, next_reconcile_at = ?,
             last_error = NULL, updated_at = ? WHERE id = ? AND state = 'submitting'`,
      ).bind(submitted.intentHash, submitted.correlationId || null, submittedAt, submittedAt, submittedAt, attempt.id),
      c.env.DB.prepare(
        "UPDATE payrun_items SET status = 'processing', intent_hash = ?, signed_at = ?, submitted_at = ?, error = NULL WHERE id = ?",
      ).bind(submitted.intentHash, submittedAt, submittedAt, attempt.item_id),
      c.env.DB.prepare(
        "UPDATE chain_records SET status = 'submitted', intent_hash = ?, signed_at = ?, submitted_at = ?, provider_status = 'SUBMITTED', error = NULL WHERE attempt_id = ?",
      ).bind(submitted.intentHash, submittedAt, submittedAt, attempt.id),
      c.env.DB.prepare(
        "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'payment.submitted', ?)",
      ).bind(uuid(), user.org_id, user.id, `Submitted payment attempt ${attempt.id} as ${submitted.intentHash}`),
    ]);
  } catch (error) {
    const detail = providerError(error);
    if (isDefinitiveSubmitFailure(detail)) {
      attempt = await failAttemptAndReopenItem(c.env, { ...attempt, state: "submitting" }, detail, user.id);
      return c.json({
        error: "Payment submission was rejected; the payroll item is reopened for a new quote",
        code: "PAYMENT_SUBMIT_REJECTED",
        detail,
        attempt,
        outcome: "failed",
        reused: false,
      }, 409);
    }
    const unknownAt = nowIso();
    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE payment_attempts
         SET state = 'processing', provider_status = 'SUBMISSION_UNKNOWN', last_error = ?,
             next_reconcile_at = ?, updated_at = ? WHERE id = ? AND state = 'submitting'`,
      ).bind(detail, unknownAt, unknownAt, attempt.id),
      c.env.DB.prepare("UPDATE payrun_items SET status = 'processing', error = ? WHERE id = ?")
        .bind("Submission outcome unknown; reconciliation scheduled", attempt.item_id),
      c.env.DB.prepare("UPDATE chain_records SET status = 'processing', provider_status = 'SUBMISSION_UNKNOWN', error = ? WHERE attempt_id = ?")
        .bind("Submission outcome unknown; reconciliation scheduled", attempt.id),
    ]);
    attempt = await getPaymentAttempt(c.env.DB, attempt.id, user.org_id);
    return c.json({ attempt, outcome: "unknown", reused: false }, 202);
  }

  attempt = await getPaymentAttempt(c.env.DB, attempt.id, user.org_id);
  return c.json({ attempt, reused: false });
});

paymentRoutes.post("/attempts/:attemptId/reconcile", requireRole("admin"), async (c) => {
  const blocked = liveGateResponse(c);
  if (blocked) return blocked;
  const user = c.get("user") as AuthUser;
  const attempt = await getPaymentAttempt(c.env.DB, c.req.param("attemptId"), user.org_id);
  if (!attempt) return c.json({ error: "Payment attempt not found" }, 404);
  if (["confirmed", "failed", "refunded"].includes(attempt.state)) return c.json({ attempt, reused: true });
  if (![
    "submitting",
    "submitted",
    "awaiting_deposit",
    "deposit_submitted",
    "funding_quoted",
    "funding_deposit_submitted",
    "funding_processing",
    "processing",
  ].includes(attempt.state)) {
    return c.json({ error: `Attempt in state ${attempt.state} is not ready for reconciliation` }, 409);
  }
  // Manual reconcile should always run (skip the cron lock) so stuck
  // unsubmitted attempts can be failed and reopened immediately.
  return c.json({ attempt: await reconcilePaymentAttempt(c.env, attempt, { force: true }), reused: false });
});

// ---------------------------------------------------------------------------
// Quick Pay: standard (ORIGIN_CHAIN F2F) or private (EOA → confidential → dest).
// Live quotes are ephemeral (HMAC context). Rows are created only on commit
// after the wallet returns a deposit tx hash.
// ---------------------------------------------------------------------------

const PRIVATE_FUNDING_BUFFER_BPS = 10; // 0.1% buffer so confidential balance covers leg B amountIn

function applyFundingBuffer(amountIn: string): string {
  const value = BigInt(amountIn);
  if (value <= 0n) throw new Error("Invalid funding base amount");
  const buffered = (value * BigInt(10_000 + PRIVATE_FUNDING_BUFFER_BPS) + 9_999n) / 10_000n;
  return buffered.toString();
}

const PAYMENT_MEMO_MAX_LENGTH = 200;

function parsePaymentMemo(raw: unknown): string | null | { error: string; code: string } {
  if (raw === undefined || raw === null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (trimmed.length > PAYMENT_MEMO_MAX_LENGTH) {
    return { error: `Memo must be at most ${PAYMENT_MEMO_MAX_LENGTH} characters`, code: "INVALID_MEMO" };
  }
  return trimmed;
}

function shortRecipientLabel(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

type QuickPayQuoteBody = {
  dry?: boolean;
  mode?: string;
  originAsset?: string;
  amount?: string | number | null;
  destinationToken?: string;
  destinationNetwork?: string;
  idempotencyKey?: string;
  memo?: unknown;
  employeeId?: string;
  destinationAddress?: string;
};

/**
 * Shared Quick Pay quote — employee recipient or ad-hoc destination address.
 * Preview quote (dry) or signed live context (no DB until commit).
 */
async function handleQuickPayQuote(
  c: Context<AppEnv>,
  body: QuickPayQuoteBody | null,
  pathEmployeeId?: string,
) {
  const user = c.get("user") as AuthUser;
  const dry = body?.dry === true;
  const modeRaw = String(body?.mode || "private").trim().toLowerCase();
  const mode = modeRaw === "standard" ? "standard" : "private";
  const originAssetId = String(body?.originAsset || "").trim();
  if (!originAssetId) return c.json({ error: "originAsset is required" }, 400);

  const memoParsed = parsePaymentMemo(body?.memo);
  if (memoParsed && typeof memoParsed === "object" && "error" in memoParsed) {
    return c.json({ error: memoParsed.error, code: memoParsed.code }, 422);
  }
  const memo = memoParsed as string | null;

  const employeeId = String(pathEmployeeId || body?.employeeId || "").trim() || null;
  const destinationAddressRaw = String(body?.destinationAddress || "").trim();

  let resolvedEmployeeId: string | null = null;
  let employeeName: string;
  let recipient: string;
  let defaultAmountMinor: number | null = null;
  let defaultToken: StableSymbol | null = null;
  let defaultNetwork: string | null = null;

  if (employeeId) {
    const employee = await c.env.DB.prepare(
      `SELECT id, name, token, network, amount_minor, endpoint, status, payout_verified_at, employee_type, created_at
       FROM employees WHERE id = ? AND org_id = ?`,
    ).bind(employeeId, user.org_id).first<{
      id: string;
      name: string;
      token: string;
      network: string;
      amount_minor: number;
      endpoint: string | null;
      status: string;
      payout_verified_at: string | null;
      employee_type: string;
      created_at: string;
    }>();
    if (!employee) return c.json({ error: "Employee not found" }, 404);
    const normalized = normalizePayoutAddress(employee.endpoint);
    if (!normalized) return c.json({ error: "Invalid employee payout address", code: "INVALID_PAYOUT_ADDRESS" }, 422);
    resolvedEmployeeId = employee.id;
    employeeName = employee.name;
    recipient = normalized;
    defaultAmountMinor = Number(employee.amount_minor);
    defaultToken = employee.token as StableSymbol;
    defaultNetwork = employee.network;
  } else if (destinationAddressRaw) {
    const normalized = normalizePayoutAddress(destinationAddressRaw);
    if (!normalized) return c.json({ error: "Invalid destination address", code: "INVALID_PAYOUT_ADDRESS" }, 422);
    recipient = normalized;
    employeeName = shortRecipientLabel(normalized);
    resolvedEmployeeId = null;
  } else {
    return c.json({ error: "employeeId or destinationAddress is required", code: "RECIPIENT_REQUIRED" }, 400);
  }

  let amountMinor = defaultAmountMinor;
  if (body?.amount !== undefined && body?.amount !== null && body?.amount !== "") {
    const parsed = parseTokenAmount(body.amount);
    if (parsed === null) return c.json({ error: "Amount must have at most 6 decimal places", code: "INVALID_AMOUNT" }, 422);
    amountMinor = parsed;
  }
  if (amountMinor == null) {
    return c.json({ error: "Amount is required for address payments", code: "INVALID_AMOUNT" }, 422);
  }
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    return c.json({ error: "Amount must be a positive token amount", code: "INVALID_AMOUNT" }, 422);
  }

  let destinationToken = defaultToken;
  let destinationNetwork = defaultNetwork;
  if (body?.destinationToken) {
    const t = String(body.destinationToken).toUpperCase();
    if (t !== "USDC" && t !== "USDT") return c.json({ error: "Unsupported destination token" }, 400);
    destinationToken = t;
  }
  if (body?.destinationNetwork) {
    destinationNetwork = String(body.destinationNetwork);
  }
  if (!destinationToken || !destinationNetwork) {
    return c.json({
      error: "destinationToken and destinationNetwork are required for address payments",
      code: "DESTINATION_REQUIRED",
    }, 400);
  }

  let supportedTokens;
  try {
    supportedTokens = await getSupportedTokens(c.env);
  } catch (error) {
    return c.json({ error: "Could not load supported tokens", code: "PAYMENT_PROVIDER_ERROR", detail: providerError(error) }, 503);
  }

  const origin = findStableAsset(supportedTokens, { assetId: originAssetId });
  if (!origin) return c.json({ error: "originAsset is not a supported phase-1 EVM stablecoin", code: "UNSUPPORTED_TOKEN" }, 422);
  const destination = findStableAssetByNetwork(supportedTokens, destinationNetwork, destinationToken);
  if (!destination) {
    return c.json({ error: `No ${destinationToken} asset on ${destinationNetwork}`, code: "UNSUPPORTED_NETWORK" }, 422);
  }

  const providerAmount = tokenMinorToAssetAmount(amountMinor, destination.decimals);
  if (!providerAmount) {
    return c.json({ error: `Amount cannot be represented with ${destination.decimals} destination decimals`, code: "AMOUNT_PRECISION_UNSUPPORTED" }, 422);
  }

  if (!user.wallet_address) {
    return c.json({ error: "An admin payment wallet is required", code: "PAYMENT_WALLET_REQUIRED" }, 422);
  }
  const refundTo = normalizePayoutAddress(user.wallet_address);
  if (!refundTo) return c.json({ error: "Payment wallet is not a valid EVM address", code: "PAYMENT_WALLET_INVALID" }, 422);

  let intentsAccountId: string;
  try {
    intentsAccountId = toIntentsUserId(user.wallet_address);
  } catch {
    return c.json({ error: "Payment wallet is not a valid EVM address", code: "PAYMENT_WALLET_INVALID" }, 422);
  }

  const confidentiality = mode === "private" ? "advanced" : resolveConfidentiality(c.env);

  // Private: fund the selected originAsset into confidential intents, then spend
  // that same asset from the confidential balance (matches docs/confidential.ts).
  // Do not require INTENTS_ASSET_MAP for Quick Pay private mode.
  const confidentialOriginAssetId = origin.assetId;

  // Dry preview: contact 1Click with dry:true, do not persist an attempt.
  if (dry) {
    try {
      if (mode === "private") {
        const payoutRequest: QuoteRequest = {
          dry: true,
          swapType: "EXACT_OUTPUT",
          originAsset: confidentialOriginAssetId,
          depositType: "CONFIDENTIAL_INTENTS",
          destinationAsset: destination.assetId,
          amount: providerAmount,
          recipient,
          recipientType: "DESTINATION_CHAIN",
          refundTo: intentsAccountId,
          refundType: "CONFIDENTIAL_INTENTS",
          confidentiality: "advanced",
          deadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          slippageTolerance: INTENTS_QUOTE_DEFAULTS.slippageTolerance,
        };
        const payoutQuote = await requestQuote(c.env, payoutRequest);
        if (!/^\d+$/.test(String(payoutQuote.quote.amountIn || "")) || BigInt(payoutQuote.quote.amountIn) <= 0n) {
          throw new Error("1Click private payout quote input amount is invalid");
        }
        const fundingAmount = applyFundingBuffer(String(payoutQuote.quote.amountIn));
        const fundingRequest: QuoteRequest = {
          dry: true,
          swapType: "EXACT_OUTPUT",
          originAsset: origin.assetId,
          depositType: "ORIGIN_CHAIN",
          destinationAsset: confidentialOriginAssetId,
          amount: fundingAmount,
          recipient: intentsAccountId,
          recipientType: "CONFIDENTIAL_INTENTS",
          refundTo,
          refundType: "ORIGIN_CHAIN",
          confidentiality: "advanced",
          deadline: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          slippageTolerance: INTENTS_QUOTE_DEFAULTS.slippageTolerance,
        };
        const fundingQuote = await requestQuote(c.env, fundingRequest);
        return c.json({
          dry: true,
          mode,
          quote: {
            amountIn: fundingQuote.quote.amountIn,
            amountOut: payoutQuote.quote.amountOut,
            timeEstimate: fundingQuote.quote.timeEstimate ?? payoutQuote.quote.timeEstimate ?? null,
            deadline: fundingQuote.quote.deadline ?? fundingRequest.deadline,
            originAsset: origin,
            destinationAsset: destination,
            confidentiality: "advanced",
            payoutAmountIn: payoutQuote.quote.amountIn,
            fundingAmountOut: fundingQuote.quote.amountOut,
          },
        });
      }

      const quoteRequest: QuoteRequest = {
        dry: true,
        swapType: "EXACT_OUTPUT",
        originAsset: origin.assetId,
        depositType: "ORIGIN_CHAIN",
        destinationAsset: destination.assetId,
        amount: providerAmount,
        recipient,
        recipientType: "DESTINATION_CHAIN",
        refundTo,
        refundType: "ORIGIN_CHAIN",
        confidentiality,
        deadline: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        slippageTolerance: INTENTS_QUOTE_DEFAULTS.slippageTolerance,
      };
      const quote = await requestQuote(c.env, quoteRequest);
      return c.json({
        dry: true,
        mode,
        quote: {
          amountIn: quote.quote.amountIn,
          amountOut: quote.quote.amountOut,
          timeEstimate: quote.quote.timeEstimate ?? null,
          deadline: quote.quote.deadline ?? quoteRequest.deadline,
          originAsset: origin,
          destinationAsset: destination,
          confidentiality,
        },
      });
    } catch (error) {
      return c.json({ error: "Quote preview failed", code: "PAYMENT_PROVIDER_ERROR", detail: providerError(error) }, 503);
    }
  }

  const blocked = liveGateResponse(c);
  if (blocked) return blocked;

  const idempotencyKey = String(body?.idempotencyKey || "").trim();
  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) {
    return c.json({ error: "idempotencyKey must be 16-128 safe characters" }, 400);
  }

  const org = await c.env.DB.prepare(
    `SELECT payment_cadence, payment_date_key, payment_configured_at
     FROM organizations WHERE id = ?`,
  ).bind(user.org_id).first<{
    payment_cadence: string | null;
    payment_date_key: string | null;
    payment_configured_at: string | null;
  }>();
  if (!org?.payment_configured_at || !org.payment_cadence || !org.payment_date_key) {
    return c.json({ error: "Team payment preferences are not configured", code: "PAYMENT_NOT_CONFIGURED" }, 409);
  }

  // Live quotes are ephemeral: return a signed context token. Rows are created
  // only after the wallet deposit succeeds (POST /payments/quick-pay/commit).
  const paymentId = uuid();
  const attemptId = uuid();

  // -------- Private live: payout quote + intent + funding quote (no DB) --------
  if (mode === "private") {
    const payoutRequest: QuoteRequest = {
      dry: false,
      swapType: "EXACT_OUTPUT",
      originAsset: confidentialOriginAssetId,
      depositType: "CONFIDENTIAL_INTENTS",
      destinationAsset: destination.assetId,
      amount: providerAmount,
      recipient,
      recipientType: "DESTINATION_CHAIN",
      refundTo: intentsAccountId,
      refundType: "CONFIDENTIAL_INTENTS",
      confidentiality: "advanced",
      deadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      slippageTolerance: INTENTS_QUOTE_DEFAULTS.slippageTolerance,
    };

    try {
      const quote = await requestQuote(c.env, payoutRequest);
      const verifiedQuoteHash = verifyOneClickQuote(c.env, payoutRequest, quote);
      const depositAddress = quote.quote?.depositAddress;
      if (!depositAddress) throw new Error("1Click quote did not include a deposit address");
      if (!/^\d+$/.test(String(quote.quote.amountIn || "")) || BigInt(quote.quote.amountIn) <= 0n) {
        throw new Error("1Click quote input amount is invalid");
      }
      if (String(quote.quote.amountOut || "") !== providerAmount) {
        throw new Error("1Click exact-output quote does not match the compensation amount");
      }
      const quoteExpiresAt = String(quote.quote.deadline || "");
      if (!quoteExpiresAt || !Number.isFinite(Date.parse(quoteExpiresAt)) || Date.parse(quoteExpiresAt) <= Date.now()) {
        throw new Error("1Click quote is missing a valid future deadline");
      }

      const generated = await generateIntent(c.env, {
        type: "swap_transfer",
        standard: "erc191",
        signerId: intentsAccountId,
        depositAddress,
      });
      if (generated.intent.standard !== "erc191" || typeof generated.intent.payload !== "string") {
        throw new Error("1Click returned an unsupported intent payload");
      }
      const payload = JSON.parse(generated.intent.payload) as { signer_id?: string };
      if (String(payload.signer_id || "").toLowerCase() !== intentsAccountId) {
        throw new Error("1Click intent signer does not match the verified payment wallet");
      }

      const fundingAmount = applyFundingBuffer(String(quote.quote.amountIn));
      const fundingRequest: QuoteRequest = {
        dry: false,
        swapType: "EXACT_OUTPUT",
        originAsset: origin.assetId,
        depositType: "ORIGIN_CHAIN",
        destinationAsset: payoutRequest.originAsset,
        amount: fundingAmount,
        recipient: intentsAccountId,
        recipientType: "CONFIDENTIAL_INTENTS",
        refundTo,
        refundType: "ORIGIN_CHAIN",
        confidentiality: "advanced",
        deadline: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        slippageTolerance: INTENTS_QUOTE_DEFAULTS.slippageTolerance,
      };
      const fundingQuote = await requestQuote(c.env, fundingRequest);
      const fundingHash = verifyOneClickQuote(c.env, fundingRequest, fundingQuote);
      const fundingDepositAddress = fundingQuote.quote?.depositAddress;
      if (!fundingDepositAddress) throw new Error("1Click funding quote did not include a deposit address");
      if (!/^\d+$/.test(String(fundingQuote.quote.amountIn || "")) || BigInt(fundingQuote.quote.amountIn) <= 0n) {
        throw new Error("1Click funding quote input amount is invalid");
      }
      if (String(fundingQuote.quote.amountOut || "") !== fundingAmount) {
        throw new Error("1Click funding exact-output quote does not match the buffered payout input");
      }
      const fundingExpiresAt = String(fundingQuote.quote.deadline || "");
      if (!fundingExpiresAt || !Number.isFinite(Date.parse(fundingExpiresAt)) || Date.parse(fundingExpiresAt) <= Date.now()) {
        throw new Error("1Click funding quote is missing a valid future deadline");
      }

      const intent = { standard: "erc191" as const, payload: generated.intent.payload };
      const context = await signQuickPayContext(c.env, {
        orgId: String(user.org_id),
        userId: user.id,
        signerId: intentsAccountId,
        employeeId: resolvedEmployeeId,
        employeeName,
        paymentId,
        attemptId,
        idempotencyKey,
        mode: "private",
        amountMinor,
        token: destinationToken,
        network: destinationNetwork,
        recipient,
        memo,
        originAssetId: origin.assetId,
        destinationAssetId: destination.assetId,
        originNetwork: origin.network,
        destinationNetwork: destination.network,
        confidentiality: "advanced",
        quoteRequest: payoutRequest,
        quoteResponse: quote,
        quoteHash: verifiedQuoteHash,
        depositAddress,
        depositMemo: quote.quote.depositMemo || null,
        quoteExpiresAt,
        intentPayload: JSON.stringify(intent),
        fundingQuoteRequest: fundingRequest,
        fundingQuoteResponse: fundingQuote,
        fundingQuoteHash: fundingHash,
        fundingDepositAddress,
        fundingDepositMemo: fundingQuote.quote.depositMemo || null,
        fundingExpiresAt,
      });

      return c.json({
        mode,
        context,
        intent,
        funding: {
          depositAddress: fundingDepositAddress,
          depositMemo: fundingQuote.quote.depositMemo || null,
          amountIn: fundingQuote.quote.amountIn,
          amountOut: fundingQuote.quote.amountOut,
          deadline: fundingExpiresAt,
        },
        quote: {
          amountIn: fundingQuote.quote.amountIn,
          amountOut: quote.quote.amountOut,
          depositAddress: fundingDepositAddress,
          depositMemo: fundingQuote.quote.depositMemo || null,
          timeEstimate: fundingQuote.quote.timeEstimate ?? quote.quote.timeEstimate ?? null,
          deadline: fundingExpiresAt,
          originAsset: origin,
          destinationAsset: destination,
          confidentiality: "advanced",
          payoutAmountIn: quote.quote.amountIn,
          fundingAmountOut: fundingQuote.quote.amountOut,
        },
      }, 200);
    } catch (error) {
      return c.json({ error: "Live private quote failed", code: "PAYMENT_PROVIDER_ERROR", detail: providerError(error) }, 503);
    }
  }

  // -------- Standard live: ORIGIN_CHAIN foreign-to-foreign (no DB) --------
  const liveRequest: QuoteRequest = {
    dry: false,
    swapType: "EXACT_OUTPUT",
    originAsset: origin.assetId,
    depositType: "ORIGIN_CHAIN",
    destinationAsset: destination.assetId,
    amount: providerAmount,
    recipient,
    recipientType: "DESTINATION_CHAIN",
    refundTo,
    refundType: "ORIGIN_CHAIN",
    confidentiality,
    deadline: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    slippageTolerance: INTENTS_QUOTE_DEFAULTS.slippageTolerance,
  };

  try {
    const quote = await requestQuote(c.env, liveRequest);
    const verifiedQuoteHash = verifyOneClickQuote(c.env, liveRequest, quote);
    const depositAddress = quote.quote?.depositAddress;
    if (!depositAddress) throw new Error("1Click quote did not include a deposit address");
    if (!/^\d+$/.test(String(quote.quote.amountIn || "")) || BigInt(quote.quote.amountIn) <= 0n) {
      throw new Error("1Click quote input amount is invalid");
    }
    if (String(quote.quote.amountOut || "") !== providerAmount) {
      throw new Error("1Click exact-output quote does not match the compensation amount");
    }
    const quoteExpiresAt = String(quote.quote.deadline || "");
    if (!quoteExpiresAt || !Number.isFinite(Date.parse(quoteExpiresAt)) || Date.parse(quoteExpiresAt) <= Date.now()) {
      throw new Error("1Click quote is missing a valid future deadline");
    }

    const context = await signQuickPayContext(c.env, {
      orgId: String(user.org_id),
      userId: user.id,
      signerId: refundTo,
      employeeId: resolvedEmployeeId,
      employeeName,
      paymentId,
      attemptId,
      idempotencyKey,
      mode: "standard",
      amountMinor,
      token: destinationToken,
      network: destinationNetwork,
      recipient,
      memo,
      originAssetId: origin.assetId,
      destinationAssetId: destination.assetId,
      originNetwork: origin.network,
      destinationNetwork: destination.network,
      confidentiality,
      quoteRequest: liveRequest,
      quoteResponse: quote,
      quoteHash: verifiedQuoteHash,
      depositAddress,
      depositMemo: quote.quote.depositMemo || null,
      quoteExpiresAt,
    });

    return c.json({
      mode,
      context,
      quote: {
        amountIn: quote.quote.amountIn,
        amountOut: quote.quote.amountOut,
        depositAddress,
        depositMemo: quote.quote.depositMemo || null,
        timeEstimate: quote.quote.timeEstimate ?? null,
        deadline: quoteExpiresAt,
        originAsset: origin,
        destinationAsset: destination,
        confidentiality,
      },
    }, 200);
  } catch (error) {
    return c.json({ error: "Live quote failed", code: "PAYMENT_PROVIDER_ERROR", detail: providerError(error) }, 503);
  }
}

/** Unified Quick Pay quote (employee or ad-hoc destination address). */
paymentRoutes.post("/quick-pay/quote", requireRole("admin"), async (c) => {
  const body = await c.req.json().catch(() => null) as QuickPayQuoteBody | null;
  return handleQuickPayQuote(c, body);
});

/** Preview quote (dry) or live context for one employee (compat wrapper). */
paymentRoutes.post("/employees/:employeeId/quote", requireRole("admin"), async (c) => {
  const body = await c.req.json().catch(() => null) as QuickPayQuoteBody | null;
  return handleQuickPayQuote(c, body, c.req.param("employeeId"));
});

/**
 * Persist a Quick Pay attempt after the ORIGIN_CHAIN deposit tx is confirmed by
 * the wallet. Accepts the signed context from the live quote (no prior DB rows).
 */
paymentRoutes.post("/quick-pay/commit", requireRole("admin"), async (c) => {
  const blocked = liveGateResponse(c);
  if (blocked) return blocked;
  const user = c.get("user") as AuthUser;
  if (!user.wallet_address) {
    return c.json({ error: "An admin payment wallet is required", code: "PAYMENT_WALLET_REQUIRED" }, 422);
  }

  const body = await c.req.json().catch(() => null);
  const contextToken = String(body?.context || "");
  const txHash = String(body?.txHash || "").trim();
  const signature = body?.signature != null ? String(body.signature) : "";

  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    return c.json({ error: "A valid EVM transaction hash is required" }, 400);
  }

  let ctx: QuickPayContextPayload;
  try {
    ctx = await verifyQuickPayContext(c.env, contextToken, {
      orgId: String(user.org_id),
      signerId: user.wallet_address,
    });
  } catch (error) {
    if (error instanceof QuickPayContextError) {
      const status = error.code === "QUICK_PAY_CONTEXT_EXPIRED" ? 409 : 400;
      // Org/signer mismatch → 403 so the client queue keeps the item for the
      // original account instead of treating it as a permanent drop.
      if (
        error.code === "QUICK_PAY_CONTEXT_ORG_MISMATCH"
        || error.code === "QUICK_PAY_CONTEXT_SIGNER_MISMATCH"
      ) {
        return c.json({ error: error.message, code: error.code }, 403);
      }
      return c.json({ error: error.message, code: error.code }, status);
    }
    throw error;
  }

  // Idempotent reuse for frontend queue retries.
  const existing = await c.env.DB.prepare(
    "SELECT * FROM payment_attempts WHERE org_id = ? AND idempotency_key = ?",
  ).bind(user.org_id, ctx.idempotencyKey).first<PaymentAttemptRow>();
  if (existing) {
    return c.json({ attempt: existing, reused: true, mode: ctx.mode });
  }

  if (ctx.mode === "private") {
    if (!/^0x[a-fA-F0-9]{130}$/.test(signature)) {
      return c.json({ error: "A valid 65-byte EVM signature is required", code: "QUICK_PAY_SIGNATURE_INVALID" }, 400);
    }
    if (!ctx.intentPayload || !ctx.fundingDepositAddress || !ctx.fundingQuoteRequest || !ctx.fundingQuoteResponse || !ctx.fundingQuoteHash) {
      return c.json({ error: "Private Quick Pay context is missing funding or intent details", code: "QUICK_PAY_CONTEXT_INVALID" }, 400);
    }
    const intent = JSON.parse(ctx.intentPayload) as { standard?: string; payload?: unknown };
    if (intent.standard !== "erc191" || typeof intent.payload !== "string") {
      return c.json({ error: "Private Quick Pay context intent is invalid", code: "QUICK_PAY_CONTEXT_INVALID" }, 400);
    }
    let valid = false;
    try {
      valid = await verifyMessage({
        address: ctx.signerId as Address,
        message: intent.payload,
        signature: signature as Hex,
      });
    } catch {
      valid = false;
    }
    if (!valid) {
      return c.json({
        error: "Payment signature does not match the verified admin wallet",
        code: "QUICK_PAY_SIGNATURE_INVALID",
      }, 400);
    }
  }

  const org = await c.env.DB.prepare(
    `SELECT payment_cadence, payment_date_key, payment_configured_at
     FROM organizations WHERE id = ?`,
  ).bind(user.org_id).first<{
    payment_cadence: string | null;
    payment_date_key: string | null;
    payment_configured_at: string | null;
  }>();
  if (!org?.payment_configured_at || !org.payment_cadence || !org.payment_date_key) {
    return c.json({ error: "Team payment preferences are not configured", code: "PAYMENT_NOT_CONFIGURED" }, 409);
  }
  const period = resolveCurrentPeriod(
    org.payment_cadence as TeamPaymentSchedule,
    org.payment_date_key as TeamPaymentDateKey,
  );

  const timestamp = nowIso();
  const depositAddressForNotify = ctx.mode === "private"
    ? String(ctx.fundingDepositAddress)
    : ctx.depositAddress;

  try {
    const paymentMemo = ctx.memo ?? null;
    const recipientName = ctx.employeeName || null;

    if (ctx.mode === "private") {
      await c.env.DB.batch([
        c.env.DB.prepare(
          `INSERT INTO employee_payments
           (id, org_id, employee_id, period_key, amount_minor, token, network, status, memo, recipient_name, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'processing', ?, ?, ?, ?)`,
        ).bind(
          ctx.paymentId,
          user.org_id,
          ctx.employeeId,
          period.periodKey,
          ctx.amountMinor,
          ctx.token,
          ctx.network,
          paymentMemo,
          recipientName,
          timestamp,
          timestamp,
        ),
        c.env.DB.prepare(
          `INSERT INTO payment_attempts
           (id, org_id, run_id, item_id, employee_payment_id, idempotency_key, flow, state, token, network,
            amount_minor, recipient, signer_id, origin_asset_id, destination_asset_id,
            deposit_address, deposit_memo, quote_request, quote_response, quote_hash, quote_expires_at,
            intent_payload, intent_signature,
            funding_deposit_address, funding_deposit_memo, funding_tx_hash,
            funding_quote_request, funding_quote_response, funding_quote_hash, funding_expires_at,
            provider_status, next_reconcile_at, created_by, created_at, updated_at)
           VALUES (?, ?, NULL, NULL, ?, ?, 'private', 'funding_deposit_submitted', ?, ?, ?, ?, ?, ?, ?,
                   ?, ?, ?, ?, ?, ?,
                   ?, ?,
                   ?, ?, ?,
                   ?, ?, ?, ?,
                   'KNOWN_DEPOSIT_TX', ?, ?, ?, ?)`,
        ).bind(
          ctx.attemptId,
          user.org_id,
          ctx.paymentId,
          ctx.idempotencyKey,
          ctx.token,
          ctx.network,
          ctx.amountMinor,
          ctx.recipient,
          ctx.signerId,
          ctx.originAssetId,
          ctx.destinationAssetId,
          ctx.depositAddress,
          ctx.depositMemo,
          JSON.stringify(ctx.quoteRequest),
          JSON.stringify(ctx.quoteResponse),
          ctx.quoteHash,
          ctx.quoteExpiresAt,
          ctx.intentPayload,
          signature,
          ctx.fundingDepositAddress,
          ctx.fundingDepositMemo ?? null,
          txHash,
          JSON.stringify(ctx.fundingQuoteRequest),
          JSON.stringify(ctx.fundingQuoteResponse),
          ctx.fundingQuoteHash,
          ctx.fundingExpiresAt ?? null,
          timestamp,
          user.id,
          timestamp,
          timestamp,
        ),
        c.env.DB.prepare(
          `INSERT INTO chain_records
           (id, attempt_id, item_id, org_id, employee_name, token, network, amount_minor,
            origin_chain, dest_chain, confidentiality, status, provider_status, quote_at, signed_at)
           VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 'confidential-intents', ?, 'advanced', 'funding_deposit_submitted', 'KNOWN_DEPOSIT_TX', ?, ?)`,
        ).bind(
          uuid(),
          ctx.attemptId,
          user.org_id,
          ctx.employeeName,
          ctx.token,
          ctx.network,
          ctx.amountMinor,
          ctx.destinationNetwork,
          timestamp,
          timestamp,
        ),
        c.env.DB.prepare(
          "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'payment.funding_deposit_submitted', ?)",
        ).bind(
          uuid(),
          user.org_id,
          user.id,
          `Committed private Quick Pay funding deposit ${txHash} as attempt ${ctx.attemptId}`,
        ),
      ]);
    } else {
      await c.env.DB.batch([
        c.env.DB.prepare(
          `INSERT INTO employee_payments
           (id, org_id, employee_id, period_key, amount_minor, token, network, status, memo, recipient_name, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'processing', ?, ?, ?, ?)`,
        ).bind(
          ctx.paymentId,
          user.org_id,
          ctx.employeeId,
          period.periodKey,
          ctx.amountMinor,
          ctx.token,
          ctx.network,
          paymentMemo,
          recipientName,
          timestamp,
          timestamp,
        ),
        c.env.DB.prepare(
          `INSERT INTO payment_attempts
           (id, org_id, run_id, item_id, employee_payment_id, idempotency_key, flow, state, token, network,
            amount_minor, recipient, signer_id, origin_asset_id, destination_asset_id,
            deposit_address, deposit_memo, deposit_tx_hash,
            quote_request, quote_response, quote_hash, quote_expires_at,
            provider_status, submitted_at, next_reconcile_at, created_by, created_at, updated_at)
           VALUES (?, ?, NULL, NULL, ?, ?, 'standard', 'deposit_submitted', ?, ?, ?, ?, ?, ?, ?,
                   ?, ?, ?,
                   ?, ?, ?, ?,
                   'KNOWN_DEPOSIT_TX', ?, ?, ?, ?, ?)`,
        ).bind(
          ctx.attemptId,
          user.org_id,
          ctx.paymentId,
          ctx.idempotencyKey,
          ctx.token,
          ctx.network,
          ctx.amountMinor,
          ctx.recipient,
          ctx.signerId,
          ctx.originAssetId,
          ctx.destinationAssetId,
          ctx.depositAddress,
          ctx.depositMemo,
          txHash,
          JSON.stringify(ctx.quoteRequest),
          JSON.stringify(ctx.quoteResponse),
          ctx.quoteHash,
          ctx.quoteExpiresAt,
          timestamp,
          timestamp,
          user.id,
          timestamp,
          timestamp,
        ),
        c.env.DB.prepare(
          `INSERT INTO chain_records
           (id, attempt_id, item_id, org_id, employee_name, token, network, amount_minor,
            origin_chain, dest_chain, confidentiality, status, provider_status, quote_at, submitted_at)
           VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'deposit_submitted', 'KNOWN_DEPOSIT_TX', ?, ?)`,
        ).bind(
          uuid(),
          ctx.attemptId,
          user.org_id,
          ctx.employeeName,
          ctx.token,
          ctx.network,
          ctx.amountMinor,
          ctx.originNetwork,
          ctx.destinationNetwork,
          ctx.confidentiality,
          timestamp,
          timestamp,
        ),
        c.env.DB.prepare(
          "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'payment.deposit_submitted', ?)",
        ).bind(
          uuid(),
          user.org_id,
          user.id,
          `Committed Quick Pay deposit ${txHash} as attempt ${ctx.attemptId}`,
        ),
      ]);
    }
  } catch (error) {
    // Concurrent commit with the same idempotency key.
    const concurrent = await c.env.DB.prepare(
      "SELECT * FROM payment_attempts WHERE org_id = ? AND idempotency_key = ?",
    ).bind(user.org_id, ctx.idempotencyKey).first<PaymentAttemptRow>();
    if (concurrent) {
      return c.json({ attempt: concurrent, reused: true, mode: ctx.mode });
    }
    return c.json({
      error: "Could not persist Quick Pay commit",
      code: "QUICK_PAY_COMMIT_FAILED",
      detail: providerError(error),
    }, 500);
  }

  try {
    await submitDepositTx(c.env, { depositAddress: depositAddressForNotify, txHash });
  } catch (error) {
    await c.env.DB.prepare(
      `UPDATE payment_attempts
       SET last_error = ?, updated_at = ?
       WHERE id = ?`,
    ).bind(providerError(error), nowIso(), ctx.attemptId).run();
    const attempt = await getPaymentAttempt(c.env.DB, ctx.attemptId, user.org_id);
    return c.json({ attempt, reused: false, mode: ctx.mode, outcome: "unknown" }, 202);
  }

  const attempt = await getPaymentAttempt(c.env.DB, ctx.attemptId, user.org_id);
  return c.json({ attempt, reused: false, mode: ctx.mode });
});

/** In-flight Quick Pay / payroll attempts for the Pending Payments dock. */
paymentRoutes.get("/pending", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const rows = await c.env.DB.prepare(
    `SELECT
       pa.id,
       pa.flow,
       pa.state,
       pa.token,
       pa.network,
       pa.amount_minor,
       pa.recipient,
       pa.provider_status,
       pa.last_error,
       pa.created_at,
       pa.updated_at,
       pa.employee_payment_id,
       pa.item_id,
       pa.run_id,
       COALESCE(e.name, pi.employee_name, 'Recipient') AS employee_name,
       COALESCE(e.id, pi.employee_id) AS employee_id
     FROM payment_attempts pa
     LEFT JOIN employee_payments ep ON ep.id = pa.employee_payment_id
     LEFT JOIN employees e ON e.id = ep.employee_id
     LEFT JOIN payrun_items pi ON pi.id = pa.item_id
     WHERE pa.org_id = ?
       AND pa.state IN (
         'quoting', 'quoted', 'generating', 'awaiting_signature',
         'submitting', 'submitted', 'awaiting_deposit', 'deposit_submitted',
         'funding_quoted', 'funding_deposit_submitted', 'funding_processing',
         'processing'
       )
     ORDER BY pa.created_at DESC
     LIMIT 50`,
  ).bind(user.org_id).all<{
    id: string;
    flow: string;
    state: string;
    token: string;
    network: string;
    amount_minor: number;
    recipient: string;
    provider_status: string | null;
    last_error: string | null;
    created_at: string;
    updated_at: string;
    employee_payment_id: string | null;
    item_id: string | null;
    run_id: string | null;
    employee_name: string;
    employee_id: string | null;
  }>();

  return c.json({
    payments: rows.results.map((row) => ({
      attemptId: row.id,
      flow: row.flow === "private" ? "private" : "standard",
      state: row.state,
      token: row.token,
      network: row.network,
      amountMinor: row.amount_minor,
      recipient: row.recipient,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      providerStatus: row.provider_status,
      lastError: row.last_error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      employeePaymentId: row.employee_payment_id,
      itemId: row.item_id,
      runId: row.run_id,
    })),
  });
});

paymentRoutes.post("/reconcile", requireRole("admin"), async (c) => {
  const blocked = liveGateResponse(c);
  if (blocked) return blocked;
  // Interactive dock reconcile must skip the cron claim/backoff lock; otherwise
  // a failed cron tick can leave next_reconcile_at in the future and the UI
  // appears "stuck" even while the admin page is open.
  return c.json(await reconcileOpenPayments(c.env, 5, { force: true }));
});

// Reopen failed payroll items so a fresh confidential quote can be created.
paymentRoutes.post("/runs/:runId/reopen-failed", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const runId = c.req.param("runId");
  const run = await c.env.DB.prepare(
    "SELECT id FROM payroll_runs WHERE id = ? AND org_id = ? AND archived_at IS NULL",
  ).bind(runId, user.org_id).first();
  if (!run) return c.json({ error: "Run not found" }, 404);

  const timestamp = nowIso();
  const result = await c.env.DB.prepare(
    `UPDATE payrun_items
     SET status = 'pending', deposit_address = NULL, intent_hash = NULL,
         signed_at = NULL, submitted_at = NULL, confirmed_at = NULL,
         error = COALESCE(error, 'Reopened after failed payment attempt')
     WHERE run_id = ? AND status = 'failed' AND removed_at IS NULL`,
  ).bind(runId).run();
  await c.env.DB.prepare("UPDATE payroll_runs SET status = 'ready', updated_at = ? WHERE id = ? AND org_id = ?")
    .bind(timestamp, runId, user.org_id).run();
  await c.env.DB.prepare(
    "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'payment.reopened', ?)",
  ).bind(uuid(), user.org_id, user.id, `Reopened failed items in run ${runId}`).run();

  return c.json({ ok: true, reopened: Number(result.meta.changes || 0) });
});

paymentRoutes.get("/runs/:runId/attempts", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const run = await c.env.DB.prepare("SELECT id FROM payroll_runs WHERE id = ? AND org_id = ? AND archived_at IS NULL")
    .bind(c.req.param("runId"), user.org_id).first();
  if (!run) return c.json({ error: "Run not found" }, 404);
  const attempts = await c.env.DB.prepare(
    "SELECT * FROM payment_attempts WHERE run_id = ? AND org_id = ? ORDER BY created_at DESC",
  ).bind(c.req.param("runId"), user.org_id).all<PaymentAttemptRow>();
  return c.json({ attempts: attempts.results });
});

// Legacy untracked execution routes remain blocked. All live calls must carry a
// persisted attempt id so retries and reconciliation are auditable.
paymentRoutes.post("/generate-intent", requireRole("admin"), (c) => c.json(liveExecutionDisabled, 409));
paymentRoutes.post("/submit-intent", requireRole("admin"), (c) => c.json(liveExecutionDisabled, 409));
paymentRoutes.post("/status", requireRole("admin"), (c) => c.json(liveExecutionDisabled, 409));
