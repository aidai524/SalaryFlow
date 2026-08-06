// Chain records (admin view) + employee self-service (own payout, records, consents)

import { Hono } from "hono";
import { verifyMessage, type Address, type Hex } from "viem";
import { requireRole, type AppEnv } from "../middleware";
import { normalizePayoutAddress, normalizePayoutNetwork, normalizePayoutToken } from "../payout";
import { nowIso, uuid, type AuthUser } from "../types";

export const recordRoutes = new Hono<AppEnv>();

// Admin: all chain records for org
recordRoutes.get("/", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const rows = await c.env.DB.prepare(
    "SELECT * FROM chain_records WHERE org_id = ? ORDER BY quote_at DESC",
  ).bind(user.org_id).all<Record<string, unknown>>();
  return c.json({ records: rows.results });
});

// Employee: own payment records (via linked employee profile)
recordRoutes.get("/me", requireRole("employee"), async (c) => {
  const user = c.get("user") as AuthUser;
  const emp = await c.env.DB.prepare("SELECT id FROM employees WHERE user_id = ?").bind(user.id).first<{ id: string }>();
  if (!emp) return c.json({ records: [] });
  const rows = await c.env.DB.prepare(
    "SELECT * FROM payrun_items WHERE employee_id = ? ORDER BY created_at DESC",
  ).bind(emp.id).all<Record<string, unknown>>();
  return c.json({ records: rows.results });
});

// Employee: own payout method
recordRoutes.get("/me/payout", requireRole("employee"), async (c) => {
  const user = c.get("user") as AuthUser;
  const emp = await c.env.DB.prepare(
    "SELECT id, name, token, network, amount_minor, endpoint, status, payout_verified_at, last_paid_at FROM employees WHERE user_id = ?",
  ).bind(user.id).first();
  if (!emp) return c.json({ payout: null });
  return c.json({ payout: emp });
});

recordRoutes.put("/me/payout", requireRole("employee"), async (c) => {
  const user = c.get("user") as AuthUser;
  const body = await c.req.json().catch(() => null);
  const emp = await c.env.DB.prepare("SELECT id FROM employees WHERE user_id = ?").bind(user.id).first<{ id: string }>();
  if (!emp) return c.json({ error: "No employee profile linked to this account" }, 404);
  const token = normalizePayoutToken(body?.token);
  const network = normalizePayoutNetwork(body?.network);
  const endpoint = normalizePayoutAddress(body?.endpoint);
  if (!token) return c.json({ error: "Only USDC and USDT are supported" }, 400);
  if (!network) return c.json({ error: "Unsupported EVM payout network" }, 400);
  if (!endpoint) return c.json({ error: "A valid EVM payout address is required" }, 400);
  // changing payout details requires reverification
  await c.env.DB.prepare(
    "UPDATE employees SET token = ?, network = ?, endpoint = ?, status = 'update_required', payout_verified_at = NULL WHERE id = ?",
  ).bind(token, network, endpoint, emp.id).run();
  return c.json({ ok: true });
});

recordRoutes.post("/me/payout/challenge", requireRole("employee"), async (c) => {
  const user = c.get("user") as AuthUser;
  const body = await c.req.json().catch(() => null);
  const token = normalizePayoutToken(body?.token);
  const network = normalizePayoutNetwork(body?.network);
  const address = normalizePayoutAddress(body?.endpoint);
  if (!token) return c.json({ error: "Only USDC and USDT are supported" }, 400);
  if (!network) return c.json({ error: "Unsupported EVM payout network" }, 400);
  if (!address) return c.json({ error: "A valid EVM payout address is required" }, 400);

  const employee = await c.env.DB.prepare(
    "SELECT id FROM employees WHERE user_id = ? AND org_id = ?",
  ).bind(user.id, user.org_id).first<{ id: string }>();
  if (!employee) return c.json({ error: "No employee profile linked to this account" }, 404);

  const id = uuid();
  const issuedAt = nowIso();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const message = [
    "SalaryFlow payout wallet verification",
    `Challenge: ${id}`,
    `Account: ${user.id}`,
    `Address: ${address}`,
    `Payout: ${token} on ${network}`,
    `Issued at: ${issuedAt}`,
    `Expires at: ${expiresAt}`,
    "Signing this message verifies wallet ownership and does not initiate a payment.",
  ].join("\n");

  await c.env.DB.prepare(
    "INSERT INTO payout_verification_challenges (id, org_id, user_id, employee_id, address, token, network, message, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(id, user.org_id, user.id, employee.id, address, token, network, message, expiresAt, issuedAt).run();
  return c.json({ challengeId: id, message, address, expiresAt });
});

recordRoutes.post("/me/payout/verify", requireRole("employee"), async (c) => {
  const user = c.get("user") as AuthUser;
  const body = await c.req.json().catch(() => null);
  const challengeId = String(body?.challengeId || "");
  const signature = String(body?.signature || "");
  if (!challengeId || !/^0x[a-fA-F0-9]{130}$/.test(signature)) {
    return c.json({ error: "challengeId and a valid EVM signature are required" }, 400);
  }

  const challenge = await c.env.DB.prepare(
    "SELECT * FROM payout_verification_challenges WHERE id = ? AND user_id = ? AND org_id = ?",
  ).bind(challengeId, user.id, user.org_id).first<Record<string, unknown>>();
  if (!challenge) return c.json({ error: "Verification challenge not found" }, 404);
  if (challenge.used_at) return c.json({ error: "Verification challenge has already been used" }, 409);
  if (new Date(String(challenge.expires_at)).getTime() < Date.now()) {
    return c.json({ error: "Verification challenge has expired" }, 410);
  }

  let valid = false;
  try {
    valid = await verifyMessage({
      address: String(challenge.address) as Address,
      message: String(challenge.message),
      signature: signature as Hex,
    });
  } catch {
    valid = false;
  }
  if (!valid) return c.json({ error: "Wallet signature does not match the payout address" }, 400);

  const verifiedAt = nowIso();
  const results = await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE payout_verification_challenges SET used_at = ? WHERE id = ? AND used_at IS NULL",
    ).bind(verifiedAt, challengeId),
    c.env.DB.prepare(
      "UPDATE employees SET token = ?, network = ?, endpoint = ?, status = 'ready', payout_verified_at = ? WHERE id = ? AND user_id = ? AND org_id = ?",
    ).bind(challenge.token, challenge.network, challenge.address, verifiedAt, challenge.employee_id, user.id, user.org_id),
    c.env.DB.prepare(
      "UPDATE users SET wallet_address = ?, wallet_verified_at = ?, updated_at = ? WHERE id = ?",
    ).bind(challenge.address, verifiedAt, verifiedAt, user.id),
    c.env.DB.prepare(
      "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'payout.verified', ?)",
    ).bind(uuid(), user.org_id, user.id, `Verified ${String(challenge.address)} for ${String(challenge.token)} on ${String(challenge.network)}`),
  ]);
  if (Number(results[0].meta.changes || 0) !== 1) {
    return c.json({ error: "Verification challenge has already been used" }, 409);
  }

  const payout = await c.env.DB.prepare(
    "SELECT id, name, token, network, amount_minor, endpoint, status, payout_verified_at, last_paid_at FROM employees WHERE id = ? AND user_id = ?",
  ).bind(challenge.employee_id, user.id).first();
  return c.json({ ok: true, payout });
});

// Employee: sign stablecoin payout consent (demo — stores record)
recordRoutes.post("/consents", requireRole("employee"), async (c) => {
  const user = c.get("user") as AuthUser;
  const body = await c.req.json().catch(() => null);
  const emp = await c.env.DB.prepare("SELECT id FROM employees WHERE user_id = ?").bind(user.id).first<{ id: string | null }>();
  await c.env.DB.prepare(
    "INSERT INTO consents (id, org_id, user_id, employee_id, signed_at, payload) VALUES (?, ?, ?, ?, ?, ?)",
  ).bind(uuid(), user.org_id, user.id, emp?.id ?? null, nowIso(), JSON.stringify(body || {})).run();
  return c.json({ ok: true, signedAt: nowIso() });
});

recordRoutes.get("/consents/me", requireRole("employee"), async (c) => {
  const user = c.get("user") as AuthUser;
  const row = await c.env.DB.prepare("SELECT id, signed_at FROM consents WHERE user_id = ?").bind(user.id).first();
  return c.json({ signed: !!row, signedAt: row ? String(row.signed_at) : null });
});

// Admin payment wallet ownership. This is separate from an employee payout
// wallet and is required before any live payment attempt can be prepared.
recordRoutes.post("/wallet/challenge", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const body = await c.req.json().catch(() => null);
  const address = normalizePayoutAddress(body?.address);
  if (!address) return c.json({ error: "A valid EVM payment wallet address is required" }, 400);
  const id = uuid();
  const issuedAt = nowIso();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const message = [
    "SalaryFlow payment wallet verification",
    `Challenge: ${id}`,
    `Account: ${user.id}`,
    `Organization: ${user.org_id}`,
    `Address: ${address}`,
    `Issued at: ${issuedAt}`,
    `Expires at: ${expiresAt}`,
    "Signing verifies wallet ownership. It does not authorize or initiate a payroll payment.",
  ].join("\n");
  await c.env.DB.prepare(
    "INSERT INTO payment_wallet_challenges (id, org_id, user_id, address, message, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).bind(id, user.org_id, user.id, address, message, expiresAt, issuedAt).run();
  return c.json({ challengeId: id, message, address, expiresAt });
});

recordRoutes.post("/wallet/verify", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const body = await c.req.json().catch(() => null);
  const challengeId = String(body?.challengeId || "");
  const signature = String(body?.signature || "");
  if (!challengeId || !/^0x[a-fA-F0-9]{130}$/.test(signature)) {
    return c.json({ error: "challengeId and a valid EVM signature are required" }, 400);
  }
  const challenge = await c.env.DB.prepare(
    "SELECT * FROM payment_wallet_challenges WHERE id = ? AND user_id = ? AND org_id = ?",
  ).bind(challengeId, user.id, user.org_id).first<Record<string, unknown>>();
  if (!challenge) return c.json({ error: "Wallet challenge not found" }, 404);
  if (challenge.used_at) return c.json({ error: "Wallet challenge has already been used" }, 409);
  if (new Date(String(challenge.expires_at)).getTime() < Date.now()) return c.json({ error: "Wallet challenge has expired" }, 410);

  let valid = false;
  try {
    valid = await verifyMessage({
      address: String(challenge.address) as Address,
      message: String(challenge.message),
      signature: signature as Hex,
    });
  } catch {
    valid = false;
  }
  if (!valid) return c.json({ error: "Wallet signature does not match the payment address" }, 400);

  if (user.wallet_address && user.wallet_address.toLowerCase() !== String(challenge.address).toLowerCase()) {
    const active = await c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM payment_attempts
       WHERE org_id = ? AND LOWER(signer_id) = LOWER(?)
         AND state IN ('created', 'quoting', 'quoted', 'generating', 'awaiting_signature', 'submitting', 'submitted', 'processing')`,
    ).bind(user.org_id, user.wallet_address).first<{ n: number }>();
    if (Number(active?.n || 0) > 0) {
      return c.json({ error: "Complete or resolve active payment attempts before changing the payment wallet", code: "ACTIVE_PAYMENT_ATTEMPTS" }, 409);
    }
  }

  const verifiedAt = nowIso();
  const results = await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE payment_wallet_challenges SET used_at = ? WHERE id = ? AND used_at IS NULL",
    ).bind(verifiedAt, challengeId),
    c.env.DB.prepare(
      "UPDATE users SET wallet_address = ?, wallet_verified_at = ?, updated_at = ? WHERE id = ? AND org_id = ?",
    ).bind(challenge.address, verifiedAt, verifiedAt, user.id, user.org_id),
    c.env.DB.prepare(
      "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'payment_wallet.verified', ?)",
    ).bind(uuid(), user.org_id, user.id, `Verified payment wallet ${String(challenge.address)}`),
  ]);
  if (Number(results[0].meta.changes || 0) !== 1) return c.json({ error: "Wallet challenge has already been used" }, 409);
  return c.json({ ok: true, wallet_address: challenge.address, wallet_verified_at: verifiedAt });
});

recordRoutes.put("/wallet", requireRole("admin"), (c) => {
  return c.json({ error: "Payment wallet ownership must be verified with a signed challenge", code: "WALLET_SIGNATURE_REQUIRED" }, 409);
});

recordRoutes.delete("/wallet", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const active = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM payment_attempts
     WHERE org_id = ? AND LOWER(signer_id) = LOWER(?)
       AND state IN ('created', 'quoting', 'quoted', 'generating', 'awaiting_signature', 'submitting', 'submitted', 'processing')`,
  ).bind(user.org_id, user.wallet_address || "").first<{ n: number }>();
  if (Number(active?.n || 0) > 0) {
    return c.json({ error: "Complete or resolve active payment attempts before removing the payment wallet", code: "ACTIVE_PAYMENT_ATTEMPTS" }, 409);
  }
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE users SET wallet_address = NULL, wallet_verified_at = NULL, updated_at = ? WHERE id = ?")
      .bind(nowIso(), user.id),
    c.env.DB.prepare(
      "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'payment_wallet.removed', 'Removed payment wallet binding')",
    ).bind(uuid(), user.org_id, user.id),
  ]);
  return c.json({ ok: true });
});
