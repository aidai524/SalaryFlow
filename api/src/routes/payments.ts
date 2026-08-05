// Payment flow: 1Click proxy (quote / generate-intent / submit-intent / status)
// The browser only sends wallet signatures; the Partner API key stays server-side.

import { Hono } from "hono";
import { requireRole, type AppEnv } from "../middleware";
import { checkSwapStatus, generateIntent, requestQuote, submitIntent } from "../intents";
import { nowIso, uuid, type AuthUser } from "../types";

export const paymentRoutes = new Hono<AppEnv>();

// Quote (dry or live). Admin triggers per batch/employee.
paymentRoutes.post("/quote", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const body = await c.req.json().catch(() => null);
  const runId = String(body?.runId || "");
  const dry = body?.dry !== false;

  if (!runId) return c.json({ error: "runId is required" }, 400);
  const run = await c.env.DB.prepare("SELECT id, org_id FROM payroll_runs WHERE id = ? AND org_id = ?").bind(runId, user.org_id).first<{ id: string }>();
  if (!run) return c.json({ error: "Run not found" }, 404);

  const items = await c.env.DB.prepare("SELECT * FROM payrun_items WHERE run_id = ? AND status = 'pending'").bind(runId).all<Record<string, unknown>>();
  if (items.results.length === 0) return c.json({ error: "No pending items in this run" }, 400);

  // In production this loops per item and requests individual quotes.
  // The prototype proxies a single representative quote for the batch.
  const first = items.results[0];
  const tokenAsset = first.token === "USDT"
    ? "nep141:usdt.tether-near" // placeholder asset id — replaced by live mapping
    : "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1"; // USDC on NEAR
  const org = await c.env.DB.prepare("SELECT id FROM organizations WHERE id = ?").bind(user.org_id).first<{ id: string }>();
  void org;

  const quote = await requestQuote(c.env, {
    dry,
    swapType: "EXACT_OUTPUT",
    originAsset: tokenAsset,
    depositType: "CONFIDENTIAL_INTENTS",
    destinationAsset: tokenAsset,
    amount: String(Number(first.amount) * 100), // cents → base units (illustrative; real conversion uses token decimals)
    recipient: user.id, // placeholder: org intents account
    recipientType: "CONFIDENTIAL_INTENTS",
    refundTo: user.id,
    refundType: "CONFIDENTIAL_INTENTS",
    confidentiality: "advanced",
    deadline: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });

  // store chain record per item
  const recordId = uuid();
  await c.env.DB.prepare(
    "INSERT INTO chain_records (id, item_id, org_id, employee_name, token, network, amount, origin_chain, dest_chain, confidentiality, status, quote_at, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'advanced', 'pending', ?, ?)",
  ).bind(recordId, first.id, user.org_id, first.employee_name, first.token, first.network, Number(first.amount), "confidential", first.network, nowIso(), dry ? "dry quote" : null).run();

  return c.json({ quote, recordId, dry, itemCount: items.results.length });
});

// Generate an unsigned intent for the wallet to sign
paymentRoutes.post("/generate-intent", requireRole("admin"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const depositAddress = String(body?.depositAddress || "");
  const signerId = String(body?.signerId || "");
  const standard = (body?.standard || "erc191") as "nep413" | "erc191";
  if (!depositAddress || !signerId) return c.json({ error: "depositAddress and signerId are required" }, 400);
  const result = await generateIntent(c.env, { type: "swap_transfer", standard, signerId, depositAddress });
  return c.json(result);
});

// Submit the wallet-signed intent
paymentRoutes.post("/submit-intent", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const body = await c.req.json().catch(() => null);
  const signedData = body?.signedData;
  const recordId = String(body?.recordId || "");
  if (!signedData) return c.json({ error: "signedData is required" }, 400);
  const result = await submitIntent(c.env, { type: "swap_transfer", signedData });
  if (recordId) {
    await c.env.DB.prepare(
      "UPDATE chain_records SET intent_hash = ?, status = 'pending', signed_at = ?, submitted_at = ? WHERE id = ?",
    ).bind(result.intentHash, nowIso(), nowIso(), recordId).run();
    // mark item pending-paid once submitted
    const rec = await c.env.DB.prepare("SELECT item_id FROM chain_records WHERE id = ?").bind(recordId).first<{ item_id: string | null }>();
    if (rec?.item_id) {
      await c.env.DB.prepare("UPDATE payrun_items SET intent_hash = ?, submitted_at = ? WHERE id = ?").bind(result.intentHash, nowIso(), rec.item_id).run();
    }
  }
  await c.env.DB.prepare("INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'payment.submitted', ?)").bind(uuid(), user.org_id, user.id, `Intent submitted ${result.intentHash}`).run();
  return c.json(result);
});

// Poll swap status
paymentRoutes.post("/status", requireRole("admin"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const depositAddress = String(body?.depositAddress || "");
  const depositMemo = body?.depositMemo ? String(body.depositMemo) : undefined;
  if (!depositAddress) return c.json({ error: "depositAddress is required" }, 400);
  const status = await checkSwapStatus(c.env, depositAddress, depositMemo);
  return c.json(status);
});
