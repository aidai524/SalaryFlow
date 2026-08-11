// Chain records (admin view) + employee self-service (own payout, records, consents)

import { Hono } from "hono";
import { verifyMessage, type Address, type Hex } from "viem";
import { requireRole, type AppEnv } from "../middleware";
import {
  type TeamPaymentDateKey,
  type TeamPaymentSchedule,
} from "../org-payment";
import { formatPaydayDisplay, resolveNextPeriod } from "../pay-period";
import { normalizePayoutAddress, normalizePayoutNetwork, normalizePayoutToken } from "../payout";
import {
  normalizePresetAvatarUrl,
  resolveRecipientSchedule,
  type EmployeeType,
} from "../recipient";
import { nowIso, uuid, type AuthUser } from "../types";

export const recordRoutes = new Hono<AppEnv>();

type EmpRow = {
  id: string;
  name: string;
  email: string | null;
  role_title: string | null;
  employee_type: string;
  token: string;
  network: string;
  amount_minor: number;
  endpoint: string | null;
  status: string;
  payout_verified_at: string | null;
  last_paid_at: string | null;
  created_at: string;
  payment_cadence: string | null;
  payment_date_key: string | null;
  avatar_url: string | null;
};

function explorerUrlForTx(network: string, txHash: string): string | null {
  const n = network.toLowerCase();
  const hash = txHash.startsWith("0x") ? txHash : `0x${txHash}`;
  if (n.includes("arbitrum")) return `https://arbiscan.io/tx/${hash}`;
  if (n.includes("base")) return `https://basescan.org/tx/${hash}`;
  if (n.includes("polygon")) return `https://polygonscan.com/tx/${hash}`;
  if (n.includes("optimism")) return `https://optimistic.etherscan.io/tx/${hash}`;
  if (n.includes("ethereum") || n === "eth" || n === "mainnet") return `https://etherscan.io/tx/${hash}`;
  return `https://basescan.org/tx/${hash}`;
}

async function loadEnrichedPayout(db: D1Database, userId: string, orgId: string) {
  const emp = await db.prepare(
    `SELECT id, name, email, role_title, employee_type, token, network, amount_minor, endpoint,
            status, payout_verified_at, last_paid_at, created_at, payment_cadence, payment_date_key,
            avatar_url
     FROM employees WHERE user_id = ? AND org_id = ?`,
  ).bind(userId, orgId).first<EmpRow>();
  if (!emp) return null;

  const org = await db.prepare(
    `SELECT payment_cadence, payment_date_key, payment_configured_at
     FROM organizations WHERE id = ?`,
  ).bind(orgId).first<{
    payment_cadence: string | null;
    payment_date_key: string | null;
    payment_configured_at: string | null;
  }>();

  const teamCadence = (org?.payment_cadence as TeamPaymentSchedule | null) || null;
  const teamDateKey = (org?.payment_date_key as TeamPaymentDateKey | null) || null;
  const teamConfigured = !!(org?.payment_configured_at && teamCadence && teamDateKey);
  const employeeType = ((emp.employee_type || "employee") as EmployeeType);

  const schedule = resolveRecipientSchedule({
    employeeType,
    teamCadence,
    teamDateKey,
    paymentCadence: emp.payment_cadence,
    paymentDateKey: emp.payment_date_key,
  });

  let nextPayday: string | null = null;
  let displayCadence: string | null = schedule?.cadence ?? null;
  let displayDateKey: string | null = schedule?.dateKey ?? null;

  if (schedule?.scheduled && schedule.dateKey && (schedule.cadence === "monthly" || schedule.cadence === "weekly")) {
    try {
      nextPayday = resolveNextPeriod(schedule.cadence, schedule.dateKey, new Date()).payday;
    } catch {
      nextPayday = null;
    }
  } else if (employeeType === "employee" && !teamConfigured) {
    displayCadence = teamCadence;
    displayDateKey = teamDateKey;
  }

  const paid = await db.prepare(
    `SELECT COALESCE(SUM(amount_minor), 0) AS total
     FROM employee_payments
     WHERE employee_id = ? AND org_id = ? AND status = 'paid'`,
  ).bind(emp.id, orgId).first<{ total: number }>();

  return {
    id: emp.id,
    name: emp.name,
    email: emp.email,
    role_title: emp.role_title,
    employee_type: employeeType,
    token: emp.token,
    network: emp.network,
    amount_minor: emp.amount_minor,
    endpoint: emp.endpoint || "",
    status: emp.status,
    payout_verified_at: emp.payout_verified_at,
    last_paid_at: emp.last_paid_at,
    created_at: emp.created_at,
    payment_cadence: displayCadence,
    payment_date_key: displayDateKey,
    nextPayday,
    nextPaydayDisplay: nextPayday ? formatPaydayDisplay(nextPayday) : null,
    avatar_url: emp.avatar_url || null,
    totalReceivedMinor: Number(paid?.total || 0),
  };
}

// Admin: all chain records for org
recordRoutes.get("/", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const rows = await c.env.DB.prepare(
    "SELECT * FROM chain_records WHERE org_id = ? ORDER BY quote_at DESC",
  ).bind(user.org_id).all<Record<string, unknown>>();
  return c.json({ records: rows.results });
});

// Employee: own payment history (Quick Pay employee_payments)
recordRoutes.get("/me", requireRole("employee"), async (c) => {
  const user = c.get("user") as AuthUser;
  if (!user.org_id) return c.json({ payments: [] });
  const emp = await c.env.DB.prepare(
    "SELECT id FROM employees WHERE user_id = ? AND org_id = ?",
  ).bind(user.id, user.org_id).first<{ id: string }>();
  if (!emp) return c.json({ payments: [] });

  const limit = Math.min(50, Math.max(1, Number.parseInt(String(c.req.query("limit") || "50"), 10) || 50));
  // Privacy: only return destination/receive tx — never admin deposit/funding tx or payer wallet.
  const rows = await c.env.DB.prepare(
    `SELECT ep.id, ep.paid_at, ep.amount_minor, ep.token, ep.network, ep.period_key, ep.status, ep.created_at,
            pa.destination_tx_hash AS tx_hash,
            pa.destination_tx_explorer_url AS tx_explorer_url
     FROM employee_payments ep
     LEFT JOIN payment_attempts pa ON pa.employee_payment_id = ep.id AND pa.state = 'confirmed'
     WHERE ep.org_id = ? AND ep.employee_id = ?
     ORDER BY COALESCE(ep.paid_at, ep.created_at) DESC, ep.id DESC
     LIMIT ?`,
  ).bind(user.org_id, emp.id, limit).all<{
    id: string;
    paid_at: string | null;
    amount_minor: number;
    token: string;
    network: string;
    period_key: string;
    status: string;
    created_at: string;
    tx_hash: string | null;
    tx_explorer_url: string | null;
  }>();

  return c.json({
    payments: rows.results.map((r) => ({
      id: r.id,
      paid_at: r.paid_at || r.created_at,
      amount_minor: r.amount_minor,
      token: r.token,
      network: r.network,
      period_key: r.period_key,
      status: r.status,
      txHash: r.tx_hash,
      explorerUrl: r.tx_explorer_url
        || (r.tx_hash && r.network ? explorerUrlForTx(r.network, r.tx_hash) : null),
    })),
  });
});

// Employee: own payout / profile summary
recordRoutes.get("/me/payout", requireRole("employee"), async (c) => {
  const user = c.get("user") as AuthUser;
  if (!user.org_id) return c.json({ payout: null });
  const payout = await loadEnrichedPayout(c.env.DB, user.id, user.org_id);
  return c.json({ payout });
});

// Employee: update own profile (name/email/payout). Changing payout clears verification.
recordRoutes.patch("/me/profile", requireRole("employee"), async (c) => {
  const user = c.get("user") as AuthUser;
  if (!user.org_id) return c.json({ error: "No organization on this account" }, 400);
  const orgId = user.org_id;
  const body = await c.req.json().catch(() => null);
  const existing = await c.env.DB.prepare(
    `SELECT id, name, email, token, network, endpoint
     FROM employees WHERE user_id = ? AND org_id = ?`,
  ).bind(user.id, orgId).first<{
    id: string;
    name: string;
    email: string | null;
    token: string;
    network: string;
    endpoint: string | null;
  }>();
  if (!existing) return c.json({ error: "No employee profile linked to this account" }, 404);

  const fields: string[] = [];
  const values: unknown[] = [];
  let syncUserName: string | null = null;
  let syncUserEmail: string | null = null;
  let payoutChanged = false;

  if (body?.name !== undefined) {
    const name = String(body.name || "").trim();
    if (!name) return c.json({ error: "Name is required" }, 400);
    fields.push("name = ?");
    values.push(name);
    syncUserName = name;
  }

  if (body?.email !== undefined) {
    const emailRaw = String(body.email || "").trim().toLowerCase();
    if (emailRaw) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
        return c.json({ error: "A valid email is required" }, 400);
      }
      const dupEmp = await c.env.DB.prepare(
        "SELECT id FROM employees WHERE org_id = ? AND email = ? AND id != ?",
      ).bind(orgId, emailRaw, existing.id).first();
      if (dupEmp) return c.json({ error: "An employee with this email already exists" }, 409);
      const dupUser = await c.env.DB.prepare(
        "SELECT id FROM users WHERE org_id = ? AND email = ? AND id != ?",
      ).bind(orgId, emailRaw, user.id).first();
      if (dupUser) return c.json({ error: "An account with this email already exists" }, 409);
      fields.push("email = ?");
      values.push(emailRaw);
      syncUserEmail = emailRaw;
    } else {
      fields.push("email = ?");
      values.push(null);
    }
  }

  if (body?.token !== undefined) {
    const token = normalizePayoutToken(body.token);
    if (!token) return c.json({ error: "Only USDC and USDT are supported" }, 400);
    if (token !== existing.token) payoutChanged = true;
    fields.push("token = ?");
    values.push(token);
  }
  if (body?.network !== undefined) {
    const network = normalizePayoutNetwork(body.network);
    if (!network) return c.json({ error: "Unsupported EVM payout network" }, 400);
    if (network !== existing.network) payoutChanged = true;
    fields.push("network = ?");
    values.push(network);
  }
  if (body?.endpoint !== undefined) {
    const endpoint = normalizePayoutAddress(body.endpoint);
    if (!endpoint) return c.json({ error: "A valid EVM payout address is required" }, 400);
    if (endpoint.toLowerCase() !== String(existing.endpoint || "").toLowerCase()) payoutChanged = true;
    fields.push("endpoint = ?");
    values.push(endpoint);
  }
  if (body?.avatar_url !== undefined || body?.avatarUrl !== undefined) {
    const avatarUrl = normalizePresetAvatarUrl(body?.avatar_url ?? body?.avatarUrl);
    if (avatarUrl === null) return c.json({ error: "Choose a valid preset avatar" }, 400);
    fields.push("avatar_url = ?");
    values.push(avatarUrl || null);
  }

  if (payoutChanged) {
    fields.push("status = 'update_required'", "payout_verified_at = NULL");
  }
  if (fields.length === 0) return c.json({ error: "Nothing to update" }, 400);

  const statements = [
    c.env.DB.prepare(
      `UPDATE employees SET ${fields.join(", ")} WHERE id = ? AND user_id = ? AND org_id = ?`,
    ).bind(...values, existing.id, user.id, orgId),
  ];
  if (syncUserName !== null || syncUserEmail !== null) {
    const userFields: string[] = [];
    const userValues: unknown[] = [];
    if (syncUserName !== null) {
      userFields.push("name = ?");
      userValues.push(syncUserName);
    }
    if (syncUserEmail !== null) {
      userFields.push("email = ?");
      userValues.push(syncUserEmail);
    }
    userFields.push("updated_at = ?");
    userValues.push(nowIso());
    statements.push(
      c.env.DB.prepare(
        `UPDATE users SET ${userFields.join(", ")} WHERE id = ? AND org_id = ?`,
      ).bind(...userValues, user.id, orgId),
    );
  }
  await c.env.DB.batch(statements);

  const payout = await loadEnrichedPayout(c.env.DB, user.id, orgId);
  return c.json({ payout, payoutChanged });
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

  if (!user.org_id) return c.json({ ok: true, payout: null });
  const payout = await loadEnrichedPayout(c.env.DB, user.id, user.org_id);
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
  // Persist the Intents-canonical form (lowercased EVM) so confidential refundTo/signerId match 1Click.
  const walletAddress = String(challenge.address).toLowerCase();
  const results = await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE payment_wallet_challenges SET used_at = ? WHERE id = ? AND used_at IS NULL",
    ).bind(verifiedAt, challengeId),
    c.env.DB.prepare(
      "UPDATE users SET wallet_address = ?, wallet_verified_at = ?, updated_at = ? WHERE id = ? AND org_id = ?",
    ).bind(walletAddress, verifiedAt, verifiedAt, user.id, user.org_id),
    c.env.DB.prepare(
      "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'payment_wallet.verified', ?)",
    ).bind(uuid(), user.org_id, user.id, `Verified payment wallet ${walletAddress}`),
  ]);
  if (Number(results[0].meta.changes || 0) !== 1) return c.json({ error: "Wallet challenge has already been used" }, 409);
  return c.json({ ok: true, wallet_address: walletAddress, wallet_verified_at: verifiedAt });
});

recordRoutes.put("/wallet", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const body = await c.req.json().catch(() => null);
  const address = normalizePayoutAddress(body?.address);
  if (!address) return c.json({ error: "A valid EVM payment wallet address is required" }, 400);

  if (user.wallet_address && user.wallet_address.toLowerCase() !== address.toLowerCase()) {
    const active = await c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM payment_attempts
       WHERE org_id = ? AND LOWER(signer_id) = LOWER(?)
         AND state IN ('created', 'quoting', 'quoted', 'generating', 'awaiting_signature', 'submitting', 'submitted', 'processing')`,
    ).bind(user.org_id, user.wallet_address).first<{ n: number }>();
    if (Number(active?.n || 0) > 0) {
      return c.json({ error: "Complete or resolve active payment attempts before changing the payment wallet", code: "ACTIVE_PAYMENT_ATTEMPTS" }, 409);
    }
  }

  const now = nowIso();
  const walletAddress = address.toLowerCase();
  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE users SET wallet_address = ?, wallet_verified_at = NULL, updated_at = ? WHERE id = ? AND org_id = ?",
    ).bind(walletAddress, now, user.id, user.org_id),
    c.env.DB.prepare(
      "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'payment_wallet.bound', ?)",
    ).bind(uuid(), user.org_id, user.id, `Bound payment wallet ${walletAddress}`),
  ]);
  return c.json({ ok: true, wallet_address: walletAddress, wallet_verified: false });
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
