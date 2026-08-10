/**
 * Cached 1Click supported tokens (USDT/USDC on phase-1 EVM chains).
 * Refresh every 30 minutes; persist to localStorage.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PHASE1_CHAINS, type ChainConfig } from "@/config/chains";
import { tokenLogoUrl } from "@/lib/logo";

const ONE_CLICK_TOKENS_URL = "https://1click.chaindefuser.com/v0/tokens";
const REFRESH_MS = 30 * 60 * 1000;

export type StableSymbol = "USDC" | "USDT";

export interface IntentsToken {
  assetId: string;
  decimals: number;
  blockchain: string;
  symbol: StableSymbol;
  providerSymbol: string;
  price: number;
  contractAddress: string | null;
  chain: ChainConfig;
  logo: string;
}

interface ProviderToken {
  assetId: string;
  decimals: number;
  blockchain: string;
  symbol: string;
  price?: number;
  contractAddress?: string | null;
}

function normalizeSymbol(symbol: string): StableSymbol | null {
  const upper = String(symbol || "").toUpperCase();
  if (upper === "USDC") return "USDC";
  if (upper === "USDT" || upper === "USDT0") return "USDT";
  return null;
}

function filterTokens(raw: ProviderToken[]): IntentsToken[] {
  const chainByCode = new Map(PHASE1_CHAINS.map((c) => [c.blockchain, c]));
  const out: IntentsToken[] = [];
  for (const t of raw) {
    const chain = chainByCode.get(t.blockchain);
    if (!chain || chain.chainKind !== "evm") continue;
    const symbol = normalizeSymbol(t.symbol);
    if (!symbol) continue;
    if (!Number.isInteger(t.decimals) || t.decimals < 0) continue;
    out.push({
      assetId: t.assetId,
      decimals: t.decimals,
      blockchain: t.blockchain,
      symbol,
      providerSymbol: t.symbol,
      price: Number(t.price || 1),
      contractAddress: t.contractAddress ?? null,
      chain,
      logo: tokenLogoUrl(symbol),
    });
  }
  return out;
}

interface IntentsTokensState {
  tokens: IntentsToken[];
  fetchedAt: number | null;
  loading: boolean;
  error: string | null;
  ensureFresh: () => Promise<void>;
  refresh: (force?: boolean) => Promise<void>;
  tokensForSymbol: (symbol: StableSymbol) => IntentsToken[];
  findByAssetId: (assetId: string) => IntentsToken | undefined;
  findByChainAndSymbol: (blockchain: string, symbol: StableSymbol) => IntentsToken | undefined;
}

export const useIntentsTokensStore = create<IntentsTokensState>()(
  persist(
    (set, get) => ({
      tokens: [],
      fetchedAt: null,
      loading: false,
      error: null,

      tokensForSymbol: (symbol) => get().tokens.filter((t) => t.symbol === symbol),

      findByAssetId: (assetId) => get().tokens.find((t) => t.assetId === assetId),

      findByChainAndSymbol: (blockchain, symbol) =>
        get().tokens.find((t) => t.blockchain === blockchain && t.symbol === symbol),

      ensureFresh: async () => {
        const { fetchedAt, tokens } = get();
        if (tokens.length > 0 && fetchedAt && Date.now() - fetchedAt < REFRESH_MS) return;
        await get().refresh();
      },

      refresh: async (force = false) => {
        const { fetchedAt, loading } = get();
        if (loading) return;
        if (!force && fetchedAt && Date.now() - fetchedAt < REFRESH_MS) return;
        set({ loading: true, error: null });
        try {
          const res = await fetch(ONE_CLICK_TOKENS_URL);
          if (!res.ok) throw new Error(`Tokens request failed (${res.status})`);
          const data = (await res.json()) as ProviderToken[];
          if (!Array.isArray(data)) throw new Error("Invalid tokens response");
          set({
            tokens: filterTokens(data),
            fetchedAt: Date.now(),
            loading: false,
            error: null,
          });
        } catch (error) {
          set({
            loading: false,
            error: error instanceof Error ? error.message : "Failed to load tokens",
          });
        }
      },
    }),
    {
      name: "decash:intents-tokens:v1",
      partialize: (s) => ({ tokens: s.tokens, fetchedAt: s.fetchedAt }),
    },
  ),
);
