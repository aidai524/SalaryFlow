import { useCallback, useEffect, useMemo, useState } from "react";
import { resolvePayOriginToken } from "@/components/you-pay/utils";
import { useIntentsTokensStore, type IntentsToken } from "@/stores/intents-tokens";
import { useQuickPayPrefsStore } from "@/stores/quick-pay-prefs";

/**
 * You Pay origin token, sourced from `useQuickPayPrefsStore`.
 * Quick Pay and Batch Payout share the same persisted preference.
 */
export function usePayOriginToken(allowedBlockchains?: string[] | null) {
  const savedOriginAssetId = useQuickPayPrefsStore((s) => s.originAssetId);
  const setSavedOriginAssetId = useQuickPayPrefsStore((s) => s.setOriginAssetId);
  const findByAssetId = useIntentsTokensStore((s) => s.findByAssetId);
  const findByChainAndSymbol = useIntentsTokensStore((s) => s.findByChainAndSymbol);
  const tokensReady = useIntentsTokensStore((s) => s.tokens.length > 0);
  const [prefsHydrated, setPrefsHydrated] = useState(() => useQuickPayPrefsStore.persist.hasHydrated());

  useEffect(() => {
    if (prefsHydrated) return;
    return useQuickPayPrefsStore.persist.onFinishHydration(() => setPrefsHydrated(true));
  }, [prefsHydrated]);

  const originToken = useMemo(() => {
    if (!prefsHydrated || !tokensReady) return null;
    return resolvePayOriginToken({
      savedOriginAssetId,
      findByAssetId,
      findByChainAndSymbol,
      allowedBlockchains: allowedBlockchains ?? null,
    });
  }, [
    prefsHydrated,
    tokensReady,
    savedOriginAssetId,
    findByAssetId,
    findByChainAndSymbol,
    allowedBlockchains,
  ]);

  const setOriginToken = useCallback((token: IntentsToken) => {
    setSavedOriginAssetId(token.assetId);
  }, [setSavedOriginAssetId]);

  return { originToken, setOriginToken, tokensReady };
}
