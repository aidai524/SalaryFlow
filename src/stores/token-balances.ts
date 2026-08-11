/**
 * Multi-chain ERC-20 balances keyed by owner + assetId.
 * Used by TokenNetworkDialog sorting and Quick Pay balance gates.
 */

import { create } from "zustand";
import type { Address } from "viem";
import type { IntentsToken } from "@/stores/intents-tokens";
import { getPublicClientForNetwork, readErc20Balance } from "@/wallet/evm/transfer";

export type TokenBalanceStatus = "idle" | "loading" | "success" | "error";

export interface TokenBalanceEntry {
  raw: bigint | null;
  formatted: string | null;
  status: TokenBalanceStatus;
  updatedAt: number | null;
  error: string | null;
}

interface TokenBalancesState {
  owner: string | null;
  balances: Record<string, TokenBalanceEntry>;
  fetchAll: (owner: string, tokens: IntentsToken[]) => Promise<void>;
  fetchOne: (owner: string, token: IntentsToken) => Promise<TokenBalanceEntry | null>;
  getBalance: (owner: string | null | undefined, assetId: string | null | undefined) => TokenBalanceEntry | undefined;
  clear: () => void;
}

function balanceKey(owner: string, assetId: string): string {
  return `${owner.toLowerCase()}:${assetId}`;
}

function loadingEntry(): TokenBalanceEntry {
  return {
    raw: null,
    formatted: null,
    status: "loading",
    updatedAt: null,
    error: null,
  };
}

function unsupportedEntry(): TokenBalanceEntry {
  return {
    raw: 0n,
    formatted: "0",
    status: "error",
    updatedAt: Date.now(),
    error: "Unsupported network",
  };
}

async function readOne(owner: string, token: IntentsToken): Promise<TokenBalanceEntry> {
  if (!token.contractAddress) {
    return {
      raw: null,
      formatted: null,
      status: "error",
      updatedAt: Date.now(),
      error: "Missing contract address",
    };
  }
  if (!getPublicClientForNetwork(token.blockchain)) {
    return unsupportedEntry();
  }
  try {
    const result = await readErc20Balance({
      network: token.blockchain,
      tokenAddress: token.contractAddress as Address,
      owner: owner as Address,
      decimals: token.decimals,
    });
    return {
      raw: result.raw,
      formatted: result.formatted,
      status: "success",
      updatedAt: Date.now(),
      error: null,
    };
  } catch (cause) {
    return {
      raw: null,
      formatted: null,
      status: "error",
      updatedAt: Date.now(),
      error: cause instanceof Error ? cause.message : "Failed to read balance",
    };
  }
}

export const useTokenBalancesStore = create<TokenBalancesState>((set, get) => ({
  owner: null,
  balances: {},

  getBalance: (owner, assetId) => {
    if (!owner || !assetId) return undefined;
    return get().balances[balanceKey(owner, assetId)];
  },

  clear: () => set({ owner: null, balances: {} }),

  fetchOne: async (owner, token) => {
    const key = balanceKey(owner, token.assetId);
    set((state) => ({
      owner: owner.toLowerCase(),
      balances: {
        ...state.balances,
        [key]: {
          ...(state.balances[key] || loadingEntry()),
          status: "loading",
          error: null,
        },
      },
    }));
    const entry = await readOne(owner, token);
    set((state) => ({
      balances: { ...state.balances, [key]: entry },
    }));
    return entry;
  },

  fetchAll: async (owner, tokens) => {
    const unique = new Map<string, IntentsToken>();
    for (const token of tokens) {
      if (!unique.has(token.assetId)) unique.set(token.assetId, token);
    }
    const list = Array.from(unique.values());
    if (list.length === 0) return;

    const ownerLower = owner.toLowerCase();
    set((state) => {
      const next = { ...state.balances };
      for (const token of list) {
        const key = balanceKey(owner, token.assetId);
        next[key] = {
          ...(next[key] || loadingEntry()),
          status: "loading",
          error: null,
        };
      }
      return { owner: ownerLower, balances: next };
    });

    const results = await Promise.allSettled(
      list.map(async (token) => {
        const entry = await readOne(owner, token);
        return { assetId: token.assetId, entry };
      }),
    );

    set((state) => {
      const next = { ...state.balances };
      for (const result of results) {
        if (result.status === "fulfilled") {
          next[balanceKey(owner, result.value.assetId)] = result.value.entry;
        }
      }
      return { balances: next };
    });
  },
}));
