import { useEffect, useMemo } from "react";
import type { IntentsToken } from "@/stores/intents-tokens";
import { useTokenBalancesStore } from "@/stores/token-balances";

export function useEnsureTokenBalances(opts: {
  owner: string | null | undefined;
  tokens: IntentsToken[];
  enabled?: boolean;
}) {
  const { owner, tokens, enabled = true } = opts;
  const fetchAll = useTokenBalancesStore((s) => s.fetchAll);
  const clear = useTokenBalancesStore((s) => s.clear);
  const tokenKey = useMemo(
    () => tokens.map((t) => t.assetId).sort().join("|"),
    [tokens],
  );

  useEffect(() => {
    if (!enabled || !owner || !tokenKey) return;
    void fetchAll(owner, tokens);
    // tokens identity tracked via tokenKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, owner, tokenKey, fetchAll]);

  useEffect(() => {
    if (!owner) clear();
  }, [owner, clear]);
}

export function useTokenBalance(
  owner: string | null | undefined,
  assetId: string | null | undefined,
) {
  return useTokenBalancesStore((s) => s.getBalance(owner, assetId));
}
