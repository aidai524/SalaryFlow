import type { AuthUser } from "@/lib/api";
import type { ChainKind } from "@/wallet";

export type ChainWalletBinding = { address: string; verified: boolean };
export type AdminWallets = Partial<Record<ChainKind, ChainWalletBinding>>;
export type ChainOwners = Partial<Record<ChainKind, string>>;

const CHAIN_KINDS: ChainKind[] = ["evm", "near", "solana"];

export function ownersByKind(user: AuthUser | null | undefined): ChainOwners {
  const owners: ChainOwners = {};
  for (const kind of CHAIN_KINDS) {
    const binding = bindingForKind(user, kind);
    if (binding?.address) owners[kind] = binding.address;
  }
  return owners;
}

export function bindingForKind(user: AuthUser | null | undefined, kind: ChainKind): ChainWalletBinding | null {
  if (!user) return null;
  const fromMap = user.wallets?.[kind];
  if (fromMap?.address) return fromMap;
  if (user.wallet_chain_kind === kind && user.wallet_address) {
    return { address: user.wallet_address, verified: Boolean(user.wallet_verified) };
  }
  return null;
}

export function withActiveWallet(user: AuthUser, kind: ChainKind): AuthUser {
  const binding = bindingForKind(user, kind);
  return {
    ...user,
    wallet_chain_kind: kind,
    wallet_address: binding?.address ?? null,
    wallet_verified: binding?.verified ?? false,
  };
}

export function withWalletBinding(
  user: AuthUser,
  kind: ChainKind,
  address: string,
  verified: boolean,
  wallets?: AdminWallets,
): AuthUser {
  const nextWallets: AdminWallets = { ...(wallets ?? user.wallets ?? {}) };
  nextWallets[kind] = { address, verified };
  return {
    ...user,
    wallets: nextWallets,
    wallet_chain_kind: kind,
    wallet_address: address,
    wallet_verified: verified,
  };
}

export function withoutWalletBinding(user: AuthUser, kind: ChainKind, wallets?: AdminWallets): AuthUser {
  const nextWallets: AdminWallets = { ...(wallets ?? user.wallets ?? {}) };
  delete nextWallets[kind];
  const remaining = CHAIN_KINDS.find((chainKind) => nextWallets[chainKind]?.address);
  const nextActive = remaining ? nextWallets[remaining] : null;
  return {
    ...user,
    wallets: nextWallets,
    wallet_chain_kind: remaining ?? null,
    wallet_address: nextActive?.address ?? null,
    wallet_verified: nextActive?.verified ?? false,
  };
}
