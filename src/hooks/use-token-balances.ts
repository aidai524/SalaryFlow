import { useEffect, useMemo } from "react";
import type { ChainOwners } from "@/lib/admin-wallets";
import type { IntentsToken } from "@/stores/intents-tokens";
import { useTokenBalancesStore } from "@/stores/token-balances";

function ownersKey(owners: ChainOwners): string {
  return (["evm", "near", "solana"] as const)
    .map((kind) => `${kind}:${owners[kind] || ""}`)
    .join("|");
}

function hasAnyOwner(owners: ChainOwners): boolean {
  return Boolean(owners.evm || owners.near || owners.solana);
}

export function useEnsureTokenBalances(opts: {
  owners: ChainOwners;
  tokens: IntentsToken[];
  enabled?: boolean;
}) {
  const { owners, tokens, enabled = true } = opts;
  const fetchAll = useTokenBalancesStore((s) => s.fetchAll);
  const clear = useTokenBalancesStore((s) => s.clear);
  const tokenKey = useMemo(
    () => tokens.map((t) => t.assetId).sort().join("|"),
    [tokens],
  );
  const ownerKey = useMemo(() => ownersKey(owners), [owners]);
  const ready = hasAnyOwner(owners);

  useEffect(() => {
    if (!enabled || !ready || !tokenKey) return;
    void fetchAll(owners, tokens);
    // tokens / owners identity tracked via tokenKey / ownerKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ready, ownerKey, tokenKey, fetchAll]);

  useEffect(() => {
    if (!ready) clear();
  }, [ready, clear]);
}

export function useTokenBalance(
  owner: string | null | undefined,
  assetId: string | null | undefined,
) {
  return useTokenBalancesStore((s) => s.getBalance(owner, assetId));
}
