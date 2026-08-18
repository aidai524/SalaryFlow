import { resolveChainKind, sameAddress, type WalletChainKind } from "./address-validation";
import type { AdminWallets, AuthUser, ChainWalletBinding } from "./types";

const CHAIN_KINDS: WalletChainKind[] = ["evm", "near", "solana"];

export function emptyAdminWallets(): AdminWallets {
  return {};
}

export function paymentAddressForKind(user: AuthUser, kind: WalletChainKind): string | null {
  return user.wallets?.[kind]?.address
    ?? (user.wallet_chain_kind === kind ? user.wallet_address : null);
}

export function matchesAnyAdminWallet(user: AuthUser, address: string, kind?: WalletChainKind | null): boolean {
  if (kind) {
    const bound = paymentAddressForKind(user, kind);
    return Boolean(bound && sameAddress(bound, address, kind));
  }
  return CHAIN_KINDS.some((chainKind) => {
    const bound = paymentAddressForKind(user, chainKind);
    return Boolean(bound && sameAddress(bound, address, chainKind));
  });
}

export async function loadAdminWallets(db: D1Database, userId: string): Promise<AdminWallets> {
  const rows = await db.prepare(
    "SELECT chain_kind, address, verified_at FROM admin_wallets WHERE user_id = ?",
  ).bind(userId).all<{ chain_kind: string; address: string; verified_at: string | null }>();
  const wallets: AdminWallets = {};
  for (const row of rows.results || []) {
    const kind = resolveChainKind(row.chain_kind);
    if (!kind || !row.address) continue;
    wallets[kind] = { address: String(row.address), verified: Boolean(row.verified_at) };
  }
  return wallets;
}

export async function getAdminWallet(
  db: D1Database,
  userId: string,
  kind: WalletChainKind,
): Promise<{ address: string; verifiedAt: string | null } | null> {
  const row = await db.prepare(
    "SELECT address, verified_at FROM admin_wallets WHERE user_id = ? AND chain_kind = ?",
  ).bind(userId, kind).first<{ address: string; verified_at: string | null }>();
  if (!row?.address) return null;
  return { address: String(row.address), verifiedAt: row.verified_at ? String(row.verified_at) : null };
}

export async function countActiveAttemptsForAddress(
  db: D1Database,
  orgId: string,
  address: string,
): Promise<number> {
  const active = await db.prepare(
    `SELECT COUNT(*) AS n FROM payment_attempts
     WHERE org_id = ? AND (signer_id = ? OR LOWER(signer_id) = LOWER(?))
       AND state IN ('created', 'quoting', 'quoted', 'generating', 'awaiting_signature', 'submitting', 'submitted', 'processing')`,
  ).bind(orgId, address, address).first<{ n: number }>();
  return Number(active?.n || 0);
}

export function withWallets(user: Omit<AuthUser, "wallets"> & { wallets?: AdminWallets }, wallets: AdminWallets): AuthUser {
  const activeKind = user.wallet_chain_kind;
  const active = activeKind ? wallets[activeKind] : null;
  return {
    ...user,
    wallets,
    wallet_address: active?.address ?? user.wallet_address,
    wallet_chain_kind: activeKind ?? user.wallet_chain_kind,
    wallet_verified: active ? active.verified : user.wallet_verified,
  };
}

export function nextActiveFromWallets(
  wallets: AdminWallets,
  preferredKind?: WalletChainKind | null,
): { kind: WalletChainKind; binding: ChainWalletBinding } | null {
  if (preferredKind && wallets[preferredKind]?.address) {
    return { kind: preferredKind, binding: wallets[preferredKind]! };
  }
  for (const kind of CHAIN_KINDS) {
    const binding = wallets[kind];
    if (binding?.address) return { kind, binding };
  }
  return null;
}
