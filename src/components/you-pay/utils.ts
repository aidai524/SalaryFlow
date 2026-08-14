import { ORIGIN_TOKEN_FALLBACKS } from "./config";
import type { IntentsToken, StableSymbol } from "@/stores/intents-tokens";

export function resolvePayOriginToken({
  savedOriginAssetId,
  findByAssetId,
  findByChainAndSymbol,
  allowedBlockchains = null,
}: {
  savedOriginAssetId: string | null;
  findByAssetId: (assetId: string) => IntentsToken | undefined;
  findByChainAndSymbol: (blockchain: string, symbol: StableSymbol) => IntentsToken | undefined;
  allowedBlockchains?: string[] | null;
}): IntentsToken | null {
  const allowed = allowedBlockchains?.length ? new Set(allowedBlockchains) : null;
  const saved = savedOriginAssetId ? findByAssetId(savedOriginAssetId) : undefined;
  if (saved && (!allowed || allowed.has(saved.blockchain))) return saved;

  const defaults = ORIGIN_TOKEN_FALLBACKS
    .map((row) => findByChainAndSymbol(row.blockchain, row.symbol))
    .filter((token): token is IntentsToken => Boolean(token));

  if (!allowed) return defaults[0] ?? null;

  const allowedDefault = defaults.find((token) => allowed.has(token.blockchain));
  if (allowedDefault) return allowedDefault;

  for (const chain of allowedBlockchains || []) {
    const token = findByChainAndSymbol(chain, "USDT") || findByChainAndSymbol(chain, "USDC");
    if (token) return token;
  }
  return null;
}
