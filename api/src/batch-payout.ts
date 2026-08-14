// Batch payout commit + list. Each recipient still gets its own employee_payments
// + payment_attempts row so destination receive txs reconcile independently.

import { explorerUrlForTx } from "./explorer";
import { submitDepositTx } from "./intents";
import {
  BATCH_PAYOUT_MAX_ITEMS,
  resolveBatchPayoutContract,
} from "./batch-payout-chains";
import {
  type TeamPaymentDateKey,
  type TeamPaymentSchedule,
} from "./org-payment";
import { resolveCurrentPeriod } from "./pay-period";
import { getPaymentAttempt } from "./payment-execution";
import {
  QuickPayContextError,
  verifyQuickPayContext,
  type QuickPayContextPayload,
} from "./quick-pay-context";
import { nowIso, uuid, type AuthUser, type Env } from "./types";

const D1_BATCH_LIMIT = 40;
const BATCH_ID_RE = /^0x[a-fA-F0-9]{64}$/;
const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export type BatchPayoutStatus = "processing" | "partial" | "completed" | "failed";

export interface BatchCommitBody {
  batchId?: string;
  txHash?: string;
  contractAddress?: string;
  originToken?: string;
  items?: Array<{ context?: string }>;
}

function providerError(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 1000) : "Unknown payment provider error";
}

function sameAddress(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

async function runStatementChunks(env: Env, statements: D1PreparedStatement[]): Promise<void> {
  for (let i = 0; i < statements.length; i += D1_BATCH_LIMIT) {
    await env.DB.batch(statements.slice(i, i + D1_BATCH_LIMIT));
  }
}

function aggregateStatus(counts: { paid: number; failed: number; open: number; total: number }): BatchPayoutStatus {
  if (counts.open > 0) return "processing";
  if (counts.failed > 0 && counts.paid > 0) return "partial";
  if (counts.failed > 0) return "failed";
  return "completed";
}

function mapItemStatus(status: string | null | undefined): string {
  if (status === "paid" || status === "failed" || status === "refunded" || status === "processing") {
    return status;
  }
  return "pending";
}

export async function commitBatchPayout(
  env: Env,
  user: AuthUser,
  body: BatchCommitBody,
): Promise<{ status: number; json: Record<string, unknown> }> {
  if (!user.wallet_address) {
    return { status: 422, json: { error: "An admin payment wallet is required", code: "PAYMENT_WALLET_REQUIRED" } };
  }

  const batchId = String(body.batchId || "").trim();
  const txHash = String(body.txHash || "").trim();
  const contractAddress = String(body.contractAddress || "").trim();
  const originToken = String(body.originToken || "").trim().toUpperCase();
  const rawItems = Array.isArray(body.items) ? body.items : [];

  if (!BATCH_ID_RE.test(batchId)) {
    return { status: 400, json: { error: "A valid 32-byte batchId is required" } };
  }
  if (!TX_HASH_RE.test(txHash)) {
    return { status: 400, json: { error: "A valid EVM transaction hash is required" } };
  }
  if (!ADDRESS_RE.test(contractAddress)) {
    return { status: 400, json: { error: "A valid BatchPayout contract address is required" } };
  }
  if (originToken !== "USDC" && originToken !== "USDT") {
    return { status: 400, json: { error: "originToken must be USDC or USDT" } };
  }
  if (rawItems.length < 1 || rawItems.length > BATCH_PAYOUT_MAX_ITEMS) {
    return { status: 400, json: { error: `Batch must contain 1–${BATCH_PAYOUT_MAX_ITEMS} items` } };
  }

  const existing = await env.DB.prepare(
    "SELECT * FROM payment_batches WHERE org_id = ? AND batch_id = ?",
  ).bind(user.org_id, batchId).first<Record<string, unknown>>();
  if (existing) {
    return { status: 200, json: { batch: existing, reused: true } };
  }

  const contexts: QuickPayContextPayload[] = [];
  for (const row of rawItems) {
    const contextToken = String(row?.context || "");
    try {
      const ctx = await verifyQuickPayContext(env, contextToken, {
        orgId: String(user.org_id),
        signerId: user.wallet_address,
      });
      contexts.push(ctx);
    } catch (error) {
      if (error instanceof QuickPayContextError) {
        const status = error.code === "QUICK_PAY_CONTEXT_EXPIRED"
          ? 409
          : error.code === "QUICK_PAY_CONTEXT_ORG_MISMATCH" || error.code === "QUICK_PAY_CONTEXT_SIGNER_MISMATCH"
            ? 403
            : 400;
        return { status, json: { error: error.message, code: error.code } };
      }
      throw error;
    }
  }

  const first = contexts[0];
  if (!first) {
    return { status: 400, json: { error: "Batch must contain 1–50 items" } };
  }

  for (const ctx of contexts) {
    if (ctx.mode !== "standard") {
      return { status: 400, json: { error: "Batch payout supports standard mode only", code: "BATCH_MODE_UNSUPPORTED" } };
    }
    if (!ctx.employeeId) {
      return { status: 400, json: { error: "Batch payout requires linked employees", code: "BATCH_EMPLOYEE_REQUIRED" } };
    }
    if (!ctx.depositAddress) {
      return { status: 400, json: { error: "Quote is missing a deposit address", code: "QUICK_PAY_CONTEXT_INVALID" } };
    }
    if (ctx.originAssetId !== first.originAssetId || ctx.originNetwork !== first.originNetwork) {
      return { status: 400, json: { error: "All items must share the same origin asset", code: "BATCH_ORIGIN_MISMATCH" } };
    }
  }

  const deployed = resolveBatchPayoutContract(first.originNetwork);
  if (!deployed) {
    return {
      status: 422,
      json: { error: "Batch payout is not deployed on this origin chain", code: "BATCH_CHAIN_NOT_DEPLOYED" },
    };
  }
  if (!sameAddress(deployed.address, contractAddress)) {
    return {
      status: 422,
      json: { error: "Contract address does not match the configured BatchPayout", code: "BATCH_CONTRACT_MISMATCH" },
    };
  }

  const depositSet = new Set<string>();
  const keySet = new Set<string>();
  for (const ctx of contexts) {
    const dep = ctx.depositAddress.toLowerCase();
    if (depositSet.has(dep)) {
      return { status: 400, json: { error: "Duplicate deposit address in batch", code: "BATCH_DUPLICATE_DEPOSIT" } };
    }
    depositSet.add(dep);
    if (keySet.has(ctx.idempotencyKey)) {
      return { status: 400, json: { error: "Duplicate idempotency key in batch", code: "BATCH_DUPLICATE_KEY" } };
    }
    keySet.add(ctx.idempotencyKey);
  }

  const placeholders = contexts.map(() => "?").join(",");
  const existingAttempt = await env.DB.prepare(
    `SELECT idempotency_key FROM payment_attempts
     WHERE org_id = ? AND idempotency_key IN (${placeholders}) LIMIT 1`,
  ).bind(user.org_id, ...contexts.map((ctx) => ctx.idempotencyKey)).first<{ idempotency_key: string }>();
  if (existingAttempt) {
    return {
      status: 409,
      json: { error: "One or more quotes were already committed", code: "IDEMPOTENCY_KEY_CONFLICT" },
    };
  }

  const org = await env.DB.prepare(
    `SELECT payment_cadence, payment_date_key, payment_configured_at
     FROM organizations WHERE id = ?`,
  ).bind(user.org_id).first<{
    payment_cadence: string | null;
    payment_date_key: string | null;
    payment_configured_at: string | null;
  }>();
  if (!org?.payment_configured_at || !org.payment_cadence || !org.payment_date_key) {
    return { status: 409, json: { error: "Team payment preferences are not configured", code: "PAYMENT_NOT_CONFIGURED" } };
  }
  const period = resolveCurrentPeriod(
    org.payment_cadence as TeamPaymentSchedule,
    org.payment_date_key as TeamPaymentDateKey,
  );

  const timestamp = nowIso();
  const rowId = uuid();
  let totalIn = 0n;
  for (const ctx of contexts) {
    const amountIn = BigInt(String(ctx.quoteResponse?.quote?.amountIn || "0"));
    if (amountIn <= 0n) {
      return { status: 400, json: { error: "Quote amountIn must be positive", code: "QUICK_PAY_CONTEXT_INVALID" } };
    }
    totalIn += amountIn;
  }

  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO payment_batches
       (id, org_id, origin_asset_id, origin_network, origin_token, contract_address, batch_id, tx_hash,
        total_amount_in, item_count, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing', ?, ?, ?)`,
    ).bind(
      rowId,
      user.org_id,
      first.originAssetId,
      first.originNetwork,
      originToken,
      contractAddress,
      batchId,
      txHash,
      totalIn.toString(),
      contexts.length,
      user.id,
      timestamp,
      timestamp,
    ),
  ];

  for (const ctx of contexts) {
    const itemId = uuid();
    statements.push(
      env.DB.prepare(
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
        ctx.memo ?? null,
        ctx.employeeName || null,
        timestamp,
        timestamp,
      ),
      env.DB.prepare(
        `INSERT INTO payment_attempts
         (id, org_id, run_id, item_id, employee_payment_id, idempotency_key, flow, state, token, network,
          amount_minor, recipient, signer_id, origin_asset_id, destination_asset_id,
          deposit_address, deposit_memo, deposit_tx_hash,
          quote_request, quote_response, quote_hash, quote_expires_at,
          provider_status, submitted_at, next_reconcile_at, created_by, created_at, updated_at, batch_id)
         VALUES (?, ?, NULL, NULL, ?, ?, 'standard', 'deposit_submitted', ?, ?, ?, ?, ?, ?, ?,
                 ?, ?, ?,
                 ?, ?, ?, ?,
                 'KNOWN_DEPOSIT_TX', ?, ?, ?, ?, ?, ?)`,
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
        rowId,
      ),
      env.DB.prepare(
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
      env.DB.prepare(
        `INSERT INTO payment_batch_items
         (id, batch_id, employee_id, employee_payment_id, attempt_id, employee_name,
          amount_minor, token, network, memo, deposit_address, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        itemId,
        rowId,
        ctx.employeeId,
        ctx.paymentId,
        ctx.attemptId,
        ctx.employeeName,
        ctx.amountMinor,
        ctx.token,
        ctx.network,
        ctx.memo ?? null,
        ctx.depositAddress,
        timestamp,
      ),
    );
  }

  statements.push(
    env.DB.prepare(
      "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'payment.batch_deposit_submitted', ?)",
    ).bind(
      uuid(),
      user.org_id,
      user.id,
      `Committed batch payout ${txHash} with ${contexts.length} items`,
    ),
  );

  try {
    await runStatementChunks(env, statements);
  } catch (error) {
    const concurrent = await env.DB.prepare(
      "SELECT * FROM payment_batches WHERE org_id = ? AND batch_id = ?",
    ).bind(user.org_id, batchId).first<Record<string, unknown>>();
    if (concurrent) {
      return { status: 200, json: { batch: concurrent, reused: true } };
    }
    return {
      status: 500,
      json: {
        error: "Could not persist batch payout commit",
        code: "BATCH_COMMIT_FAILED",
        detail: providerError(error),
      },
    };
  }

  let notifyFailed = false;
  for (const ctx of contexts) {
    try {
      await submitDepositTx(env, { depositAddress: ctx.depositAddress, txHash });
    } catch (error) {
      notifyFailed = true;
      await env.DB.prepare(
        `UPDATE payment_attempts SET last_error = ?, updated_at = ? WHERE id = ?`,
      ).bind(providerError(error), nowIso(), ctx.attemptId).run();
    }
  }

  const batch = await env.DB.prepare(
    "SELECT * FROM payment_batches WHERE id = ?",
  ).bind(rowId).first<Record<string, unknown>>();

  const attempts = [];
  for (const ctx of contexts) {
    attempts.push(await getPaymentAttempt(env.DB, ctx.attemptId, user.org_id));
  }

  if (notifyFailed) {
    return { status: 202, json: { batch, attempts, reused: false, outcome: "unknown" } };
  }
  return { status: 200, json: { batch, attempts, reused: false } };
}

interface BatchListRow {
  id: string;
  origin_asset_id: string;
  origin_network: string;
  origin_token: string;
  contract_address: string;
  batch_id: string;
  tx_hash: string;
  total_amount_in: string;
  item_count: number;
  status: string;
  created_at: string;
  updated_at: string;
  paid_count: number;
  failed_count: number;
  open_count: number;
}

function serializeBatch(row: BatchListRow) {
  const counts = {
    paid: Number(row.paid_count || 0),
    failed: Number(row.failed_count || 0),
    open: Number(row.open_count || 0),
    total: Number(row.item_count || 0),
  };
  const status = aggregateStatus(counts);
  return {
    id: row.id,
    originAssetId: row.origin_asset_id,
    originNetwork: row.origin_network,
    originToken: row.origin_token,
    contractAddress: row.contract_address,
    batchId: row.batch_id,
    txHash: row.tx_hash,
    adminExplorerUrl: explorerUrlForTx(row.origin_network, row.tx_hash),
    totalAmountIn: row.total_amount_in,
    itemCount: counts.total,
    status,
    paidCount: counts.paid,
    failedCount: counts.failed,
    processingCount: counts.open,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const BATCH_LIST_SELECT = `
  SELECT
    b.id, b.origin_asset_id, b.origin_network, b.origin_token, b.contract_address,
    b.batch_id, b.tx_hash, b.total_amount_in, b.item_count, b.status, b.created_at, b.updated_at,
    SUM(CASE WHEN ep.status = 'paid' THEN 1 ELSE 0 END) AS paid_count,
    SUM(CASE WHEN ep.status IN ('failed', 'refunded') THEN 1 ELSE 0 END) AS failed_count,
    SUM(CASE WHEN ep.status IS NULL OR ep.status IN ('pending', 'processing') THEN 1 ELSE 0 END) AS open_count
  FROM payment_batches b
  LEFT JOIN payment_batch_items i ON i.batch_id = b.id
  LEFT JOIN employee_payments ep ON ep.id = i.employee_payment_id
`;

export async function listPaymentBatches(
  env: Env,
  orgId: string,
  page: number,
  pageSize: number,
): Promise<{ batches: ReturnType<typeof serializeBatch>[]; total: number; page: number; pageSize: number }> {
  const safePage = Math.max(1, page);
  const safeSize = Math.min(50, Math.max(1, pageSize));
  const offset = (safePage - 1) * safeSize;

  const totalRow = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM payment_batches WHERE org_id = ?",
  ).bind(orgId).first<{ n: number }>();
  const total = Number(totalRow?.n || 0);

  const rows = await env.DB.prepare(
    `${BATCH_LIST_SELECT}
     WHERE b.org_id = ?
     GROUP BY b.id
     ORDER BY b.created_at DESC
     LIMIT ? OFFSET ?`,
  ).bind(orgId, safeSize, offset).all<BatchListRow>();

  return {
    batches: rows.results.map(serializeBatch),
    total,
    page: safePage,
    pageSize: safeSize,
  };
}

export async function getPaymentBatch(
  env: Env,
  orgId: string,
  id: string,
): Promise<{ batch: ReturnType<typeof serializeBatch>; items: Array<Record<string, unknown>> } | null> {
  const row = await env.DB.prepare(
    `${BATCH_LIST_SELECT}
     WHERE b.org_id = ? AND b.id = ?
     GROUP BY b.id`,
  ).bind(orgId, id).first<BatchListRow>();
  if (!row) return null;

  const items = await env.DB.prepare(
    `SELECT
       i.id, i.employee_id, i.employee_name, i.amount_minor, i.token, i.network, i.memo, i.deposit_address,
       ep.status AS payment_status,
       pa.deposit_tx_hash, pa.destination_tx_hash, pa.destination_tx_explorer_url, pa.state AS attempt_state
     FROM payment_batch_items i
     LEFT JOIN employee_payments ep ON ep.id = i.employee_payment_id
     LEFT JOIN payment_attempts pa ON pa.id = i.attempt_id
     WHERE i.batch_id = ?
     ORDER BY i.created_at ASC`,
  ).bind(id).all<{
    id: string;
    employee_id: string | null;
    employee_name: string;
    amount_minor: number;
    token: string;
    network: string;
    memo: string | null;
    deposit_address: string;
    payment_status: string | null;
    deposit_tx_hash: string | null;
    destination_tx_hash: string | null;
    destination_tx_explorer_url: string | null;
    attempt_state: string | null;
  }>();

  return {
    batch: serializeBatch(row),
    items: items.results.map((item) => {
      const adminTxHash = item.deposit_tx_hash || row.tx_hash;
      const receiveTxHash = item.destination_tx_hash || null;
      return {
        id: item.id,
        employeeId: item.employee_id,
        employeeName: item.employee_name,
        amountMinor: item.amount_minor,
        token: item.token,
        network: item.network,
        memo: item.memo,
        status: mapItemStatus(item.payment_status),
        adminTxHash,
        adminExplorerUrl: adminTxHash ? explorerUrlForTx(row.origin_network, adminTxHash) : null,
        receiveTxHash,
        receiveExplorerUrl:
          (receiveTxHash ? explorerUrlForTx(item.network, receiveTxHash) : null)
          || item.destination_tx_explorer_url
          || null,
      };
    }),
  };
}
