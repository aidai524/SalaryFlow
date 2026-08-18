// Chain records (admin view) + employee self-service (own payout, records, consents)

import { Hono } from "hono";
import { explorerUrlForTx } from "../explorer";
import { requireRole, type AppEnv } from "../middleware";
import {
  type TeamPaymentDateKey,
  type TeamPaymentSchedule,
} from "../org-payment";
import { formatPaydayDisplay, resolveUpcomingPayday } from "../pay-period";
import { normalizePayoutAddress, normalizePayoutNetwork, normalizePayoutToken } from "../payout";
import { resolveChainKind, sameAddress } from "../address-validation";
import {
  countActiveAttemptsForAddress,
  getAdminWallet,
  loadAdminWallets,
  nextActiveFromWallets,
} from "../admin-wallets";
import { NEAR_SIGN_RECIPIENT, randomNonceBase64, verifyWalletOwnership } from "../verify-wallet";
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
      nextPayday = resolveUpcomingPayday(schedule.cadence, schedule.dateKey, new Date());
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
  if (!user.org_id) return c.json({ payments: [], total: 0, page: 1, pageSize: 10 });
  const emp = await c.env.DB.prepare(
    "SELECT id FROM employees WHERE user_id = ? AND org_id = ?",
  ).bind(user.id, user.org_id).first<{ id: string }>();
  const page = Math.max(1, Number.parseInt(String(c.req.query("page") || "1"), 10) || 1);
  const pageSize = Math.min(50, Math.max(1, Number.parseInt(String(c.req.query("pageSize") || c.req.query("limit") || "10"), 10) || 10));
  if (!emp) return c.json({ payments: [], total: 0, page, pageSize });

  const offset = (page - 1) * pageSize;
  const countRow = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM employee_payments WHERE org_id = ? AND employee_id = ?",
  ).bind(user.org_id, emp.id).first<{ n: number }>();
  const total = Number(countRow?.n || 0);

  // Privacy: only return destination/receive tx — never admin deposit/funding tx or payer wallet.
  const rows = await c.env.DB.prepare(
    `SELECT ep.id, ep.paid_at, ep.amount_minor, ep.token, ep.network, ep.period_key, ep.status, ep.created_at,
            ep.memo,
            pa.destination_tx_hash AS tx_hash,
            pa.destination_tx_explorer_url AS tx_explorer_url
     FROM employee_payments ep
     LEFT JOIN payment_attempts pa ON pa.employee_payment_id = ep.id AND pa.state = 'confirmed'
     WHERE ep.org_id = ? AND ep.employee_id = ?
     ORDER BY COALESCE(ep.paid_at, ep.created_at) DESC, ep.id DESC
     LIMIT ? OFFSET ?`,
  ).bind(user.org_id, emp.id, pageSize, offset).all<{
    id: string;
    paid_at: string | null;
    amount_minor: number;
    token: string;
    network: string;
    period_key: string;
    status: string;
    created_at: string;
    memo: string | null;
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
      memo: r.memo,
      txHash: r.tx_hash,
      explorerUrl: (r.tx_hash && r.network
        ? explorerUrlForTx(r.network, r.tx_hash)
        : null)
        || r.tx_explorer_url
        || null,
    })),
    total,
    page,
    pageSize,
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
    if (!network) return c.json({ error: "Unsupported payout network" }, 400);
    if (network !== existing.network) payoutChanged = true;
    fields.push("network = ?");
    values.push(network);
  }
  if (body?.endpoint !== undefined) {
    const nextNetwork = body?.network !== undefined
      ? normalizePayoutNetwork(body.network)
      : String(existing.network || "");
    const endpoint = nextNetwork ? normalizePayoutAddress(body.endpoint, nextNetwork) : null;
    if (!endpoint) return c.json({ error: "A valid payout address is required for the selected network" }, 400);
    if (!sameAddress(endpoint, String(existing.endpoint || ""), nextNetwork)) payoutChanged = true;
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
  const endpoint = network ? normalizePayoutAddress(body?.endpoint, network) : null;
  if (!token) return c.json({ error: "Only USDC and USDT are supported" }, 400);
  if (!network) return c.json({ error: "Unsupported payout network" }, 400);
  if (!endpoint) return c.json({ error: "A valid payout address is required for the selected network" }, 400);
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
  const address = network ? normalizePayoutAddress(body?.endpoint, network) : null;
  if (!token) return c.json({ error: "Only USDC and USDT are supported" }, 400);
  if (!network) return c.json({ error: "Unsupported payout network" }, 400);
  if (!address) return c.json({ error: "A valid payout address is required for the selected network" }, 400);

  const employee = await c.env.DB.prepare(
    "SELECT id FROM employees WHERE user_id = ? AND org_id = ?",
  ).bind(user.id, user.org_id).first<{ id: string }>();
  if (!employee) return c.json({ error: "No employee profile linked to this account" }, 404);

  const id = uuid();
  const issuedAt = nowIso();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const chainKind = resolveChainKind(network);
  const nonce = chainKind === "near" ? randomNonceBase64() : null;
  const recipient = chainKind === "near" ? NEAR_SIGN_RECIPIENT : null;
  const message = [
    "Stableflow Pay payout wallet verification",
    `Challenge: ${id}`,
    `Account: ${user.id}`,
    `Address: ${address}`,
    `Payout: ${token} on ${network}`,
    `Issued at: ${issuedAt}`,
    `Expires at: ${expiresAt}`,
    "Signing this message verifies wallet ownership and does not initiate a payment.",
  ].join("\n");

  await c.env.DB.prepare(
    "INSERT INTO payout_verification_challenges (id, org_id, user_id, employee_id, address, token, network, message, nonce, recipient, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(id, user.org_id, user.id, employee.id, address, token, network, message, nonce, recipient, expiresAt, issuedAt).run();
  return c.json({ challengeId: id, message, address, expiresAt, chainKind, nonce, recipient });
});

recordRoutes.post("/me/payout/verify", requireRole("employee"), async (c) => {
  const user = c.get("user") as AuthUser;
  const body = await c.req.json().catch(() => null);
  const challengeId = String(body?.challengeId || "");
  const signature = String(body?.signature || "");
  if (!challengeId || !signature) {
    return c.json({ error: "challengeId and signature are required" }, 400);
  }

  const challenge = await c.env.DB.prepare(
    "SELECT * FROM payout_verification_challenges WHERE id = ? AND user_id = ? AND org_id = ?",
  ).bind(challengeId, user.id, user.org_id).first<Record<string, unknown>>();
  if (!challenge) return c.json({ error: "Verification challenge not found" }, 404);
  if (challenge.used_at) return c.json({ error: "Verification challenge has already been used" }, 409);
  if (new Date(String(challenge.expires_at)).getTime() < Date.now()) {
    return c.json({ error: "Verification challenge has expired" }, 410);
  }

  const chainKind = resolveChainKind(String(challenge.network));
  const valid = await verifyWalletOwnership({
    chainKind,
    address: String(challenge.address),
    message: String(challenge.message),
    signature,
    publicKey: body?.publicKey ? String(body.publicKey) : null,
    nonce: challenge.nonce ? String(challenge.nonce) : null,
    recipient: challenge.recipient ? String(challenge.recipient) : null,
    accountId: body?.accountId ? String(body.accountId) : null,
  });
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
      "UPDATE users SET wallet_address = ?, wallet_chain_kind = ?, wallet_verified_at = ?, updated_at = ? WHERE id = ?",
    ).bind(challenge.address, chainKind, verifiedAt, verifiedAt, user.id),
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
  const chainKind = resolveChainKind(body?.chainKind || body?.chain_kind);
  const address = chainKind ? normalizePayoutAddress(body?.address, chainKind) : null;
  if (!chainKind || !address) return c.json({ error: "A valid payment wallet address is required" }, 400);
  const id = uuid();
  const issuedAt = nowIso();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const nonce = chainKind === "near" ? randomNonceBase64() : null;
  const recipient = chainKind === "near" ? NEAR_SIGN_RECIPIENT : null;
  const message = [
    "Stableflow Pay payment wallet verification",
    `Challenge: ${id}`,
    `Account: ${user.id}`,
    `Organization: ${user.org_id}`,
    `Address: ${address}`,
    `Issued at: ${issuedAt}`,
    `Expires at: ${expiresAt}`,
    "Signing verifies wallet ownership. It does not authorize or initiate a payroll payment.",
  ].join("\n");
  await c.env.DB.prepare(
    "INSERT INTO payment_wallet_challenges (id, org_id, user_id, address, chain_kind, nonce, recipient, message, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(id, user.org_id, user.id, address, chainKind, nonce, recipient, message, expiresAt, issuedAt).run();
  return c.json({ challengeId: id, message, address, expiresAt, chainKind, nonce, recipient });
});

recordRoutes.post("/wallet/verify", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const body = await c.req.json().catch(() => null);
  const challengeId = String(body?.challengeId || "");
  const signature = String(body?.signature || "");
  if (!challengeId || !signature) {
    return c.json({ error: "challengeId and signature are required" }, 400);
  }
  const challenge = await c.env.DB.prepare(
    "SELECT * FROM payment_wallet_challenges WHERE id = ? AND user_id = ? AND org_id = ?",
  ).bind(challengeId, user.id, user.org_id).first<Record<string, unknown>>();
  if (!challenge) return c.json({ error: "Wallet challenge not found" }, 404);
  if (challenge.used_at) return c.json({ error: "Wallet challenge has already been used" }, 409);
  if (new Date(String(challenge.expires_at)).getTime() < Date.now()) return c.json({ error: "Wallet challenge has expired" }, 410);

  const chainKind = resolveChainKind(String(challenge.chain_kind || "evm"));
  if (!chainKind) return c.json({ error: "Wallet challenge is missing a chain" }, 400);
  const valid = await verifyWalletOwnership({
    chainKind,
    address: String(challenge.address),
    message: String(challenge.message),
    signature,
    publicKey: body?.publicKey ? String(body.publicKey) : null,
    nonce: challenge.nonce ? String(challenge.nonce) : null,
    recipient: challenge.recipient ? String(challenge.recipient) : null,
    accountId: body?.accountId ? String(body.accountId) : null,
  });
  if (!valid) return c.json({ error: "Wallet signature does not match the payment address" }, 400);

  const challengeAddress = String(challenge.address);
  const existing = await getAdminWallet(c.env.DB, user.id, chainKind);
  if (existing && !sameAddress(existing.address, challengeAddress, chainKind)) {
    const active = await countActiveAttemptsForAddress(c.env.DB, String(user.org_id), existing.address);
    if (active > 0) {
      return c.json({ error: "Complete or resolve active payment attempts before changing the payment wallet", code: "ACTIVE_PAYMENT_ATTEMPTS" }, 409);
    }
  }

  const verifiedAt = nowIso();
  const walletAddress = challengeAddress;
  const results = await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE payment_wallet_challenges SET used_at = ? WHERE id = ? AND used_at IS NULL",
    ).bind(verifiedAt, challengeId),
    c.env.DB.prepare(
      `INSERT INTO admin_wallets (user_id, chain_kind, address, verified_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, chain_kind) DO UPDATE SET
         address = excluded.address,
         verified_at = excluded.verified_at,
         updated_at = excluded.updated_at`,
    ).bind(user.id, chainKind, walletAddress, verifiedAt, verifiedAt),
    c.env.DB.prepare(
      "UPDATE users SET wallet_address = ?, wallet_chain_kind = ?, wallet_verified_at = ?, updated_at = ? WHERE id = ? AND org_id = ?",
    ).bind(walletAddress, chainKind, verifiedAt, verifiedAt, user.id, user.org_id),
    c.env.DB.prepare(
      "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'payment_wallet.verified', ?)",
    ).bind(uuid(), user.org_id, user.id, `Verified payment wallet ${walletAddress}`),
  ]);
  if (Number(results[0].meta.changes || 0) !== 1) return c.json({ error: "Wallet challenge has already been used" }, 409);
  const wallets = await loadAdminWallets(c.env.DB, user.id);
  return c.json({ ok: true, wallet_address: walletAddress, wallet_chain_kind: chainKind, wallet_verified_at: verifiedAt, wallet_verified: true, wallets });
});

recordRoutes.put("/wallet", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const body = await c.req.json().catch(() => null);
  const chainKind = resolveChainKind(body?.chainKind || body?.chain_kind);
  const address = chainKind ? normalizePayoutAddress(body?.address, chainKind) : null;
  if (!chainKind || !address) return c.json({ error: "A valid payment wallet address is required" }, 400);

  const existing = await getAdminWallet(c.env.DB, user.id, chainKind);
  const sameBinding = Boolean(existing && sameAddress(existing.address, address, chainKind));
  if (existing && !sameBinding) {
    const active = await countActiveAttemptsForAddress(c.env.DB, String(user.org_id), existing.address);
    if (active > 0) {
      return c.json({ error: "Complete or resolve active payment attempts before changing the payment wallet", code: "ACTIVE_PAYMENT_ATTEMPTS" }, 409);
    }
  }

  const now = nowIso();
  const verifiedAt = sameBinding ? existing?.verifiedAt ?? null : null;
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO admin_wallets (user_id, chain_kind, address, verified_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, chain_kind) DO UPDATE SET
         address = excluded.address,
         verified_at = excluded.verified_at,
         updated_at = excluded.updated_at`,
    ).bind(user.id, chainKind, address, verifiedAt, now),
    c.env.DB.prepare(
      "UPDATE users SET wallet_address = ?, wallet_chain_kind = ?, wallet_verified_at = ?, updated_at = ? WHERE id = ? AND org_id = ?",
    ).bind(address, chainKind, verifiedAt, now, user.id, user.org_id),
    c.env.DB.prepare(
      "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'payment_wallet.bound', ?)",
    ).bind(uuid(), user.org_id, user.id, `Bound payment wallet ${address}`),
  ]);
  const wallets = await loadAdminWallets(c.env.DB, user.id);
  return c.json({
    ok: true,
    wallet_address: address,
    wallet_chain_kind: chainKind,
    wallet_verified: Boolean(verifiedAt),
    wallets,
  });
});

recordRoutes.delete("/wallet", requireRole("admin"), async (c) => {
  const user = c.get("user") as AuthUser;
  const requestedKind = resolveChainKind(c.req.query("chainKind") || user.wallet_chain_kind);
  if (!requestedKind) return c.json({ error: "A payment wallet chain is required" }, 400);

  const existing = await getAdminWallet(c.env.DB, user.id, requestedKind);
  if (existing) {
    const active = await countActiveAttemptsForAddress(c.env.DB, String(user.org_id), existing.address);
    if (active > 0) {
      return c.json({ error: "Complete or resolve active payment attempts before removing the payment wallet", code: "ACTIVE_PAYMENT_ATTEMPTS" }, 409);
    }
  }

  const now = nowIso();
  await c.env.DB.prepare(
    "DELETE FROM admin_wallets WHERE user_id = ? AND chain_kind = ?",
  ).bind(user.id, requestedKind).run();
  const wallets = await loadAdminWallets(c.env.DB, user.id);
  const next = nextActiveFromWallets(wallets);
  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE users SET wallet_address = ?, wallet_chain_kind = ?, wallet_verified_at = ?, updated_at = ? WHERE id = ?",
    ).bind(next?.binding.address ?? null, next?.kind ?? null, next?.binding.verified ? now : null, now, user.id),
    c.env.DB.prepare(
      "INSERT INTO audit_log (id, org_id, actor_id, action, detail) VALUES (?, ?, ?, 'payment_wallet.removed', ?)",
    ).bind(uuid(), user.org_id, user.id, `Removed ${requestedKind} payment wallet binding`),
  ]);
  return c.json({
    ok: true,
    wallet_address: next?.binding.address ?? null,
    wallet_chain_kind: next?.kind ?? null,
    wallet_verified: Boolean(next?.binding.verified),
    wallets,
  });
});
