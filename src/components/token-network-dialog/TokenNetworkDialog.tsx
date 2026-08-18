import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEnsureTokenBalances } from "@/hooks/use-token-balances";
import type { WalletChainKind } from "@/lib/address-validation";
import type { ChainOwners } from "@/lib/admin-wallets";
import { formatNumber } from "@/lib/format";
import { chainLogoUrl, tokenLogoUrl } from "@/lib/logo";
import { cn } from "@/lib/utils";
import {
  useIntentsTokensStore,
  type IntentsToken,
  type StableSymbol,
} from "@/stores/intents-tokens";
import { useTokenBalancesStore } from "@/stores/token-balances";

export interface TokenNetworkSelection {
  token: IntentsToken;
}

interface TokenNetworkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** Preselect symbol tab. */
  initialSymbol?: StableSymbol;
  /** Currently selected assetId. */
  selectedAssetId?: string | null;
  /** Fetch & show wallet balances; sort chains by balance desc. Origin pay only. */
  showBalances?: boolean;
  /**
   * Bound payment wallet addresses by chain kind (account wallets).
   * Do not pass a browser-session-only wagmi address.
   */
  balanceOwners?: ChainOwners;
  /** Restrict origin chains (1Click blockchain codes). Destination pickers omit this. */
  allowedBlockchains?: string[] | null;
  /**
   * When set, chains of a different kind are shown but disabled.
   * Used when the recipient address cannot be edited in this flow.
   */
  lockChainKind?: WalletChainKind | null;
  onSelect: (selection: TokenNetworkSelection) => void;
}

function ownerForToken(owners: ChainOwners | null | undefined, token: IntentsToken): string | null {
  const kind = token.chain.chainKind;
  if (kind !== "evm" && kind !== "near" && kind !== "solana") return null;
  return owners?.[kind] ?? null;
}

function hasAnyOwner(owners: ChainOwners | null | undefined): boolean {
  return Boolean(owners?.evm || owners?.near || owners?.solana);
}

const SYMBOLS: StableSymbol[] = ["USDT", "USDC"];

function chainKindLabel(kind: WalletChainKind): string {
  if (kind === "near") return "Near";
  if (kind === "solana") return "Solana";
  return "EVM";
}

/** Sort by human units, not raw wei — USDC decimals differ by chain (e.g. BSC 18 vs ETH 6). */
function balanceSortValue(
  formatted: string | null | undefined,
  status: string | undefined,
): number {
  if (status === "success" && formatted != null) {
    const asNumber = Number(formatted);
    return Number.isFinite(asNumber) ? asNumber : -1;
  }
  return -1;
}

export function TokenNetworkDialog({
  open,
  onOpenChange,
  title = "Select token",
  initialSymbol = "USDC",
  selectedAssetId,
  showBalances = false,
  balanceOwners = {},
  allowedBlockchains = null,
  lockChainKind = null,
  onSelect,
}: TokenNetworkDialogProps) {
  const owners = showBalances ? balanceOwners : {};
  const ensureFresh = useIntentsTokensStore((s) => s.ensureFresh);
  const tokens = useIntentsTokensStore((s) => s.tokens);
  const loading = useIntentsTokensStore((s) => s.loading);
  const balances = useTokenBalancesStore((s) => s.balances);
  const getBalance = useTokenBalancesStore((s) => s.getBalance);
  const [symbol, setSymbol] = useState<StableSymbol>(initialSymbol);

  useEffect(() => {
    if (open) {
      void ensureFresh();
      setSymbol(initialSymbol);
    }
  }, [open, ensureFresh, initialSymbol]);

  const allowed = useMemo(() => {
    if (!allowedBlockchains || allowedBlockchains.length === 0) return null;
    return new Set(allowedBlockchains.map((code) => code.toLowerCase()));
  }, [allowedBlockchains]);

  const chainsForSymbol = useMemo(() => {
    return tokens.filter((t) => {
      if (t.symbol !== symbol) return false;
      if (!allowed) return true;
      return allowed.has(t.blockchain.toLowerCase());
    });
  }, [tokens, symbol, allowed]);

  useEnsureTokenBalances({
    owners,
    tokens: chainsForSymbol,
    enabled: showBalances && open && hasAnyOwner(owners) && chainsForSymbol.length > 0,
  });

  const sortedChains = useMemo(() => {
    if (!showBalances) {
      return chainsForSymbol
        .slice()
        .sort((a, b) => a.chain.chainName.localeCompare(b.chain.chainName));
    }
    return chainsForSymbol.slice().sort((a, b) => {
      const aEntry = getBalance(ownerForToken(owners, a), a.assetId);
      const bEntry = getBalance(ownerForToken(owners, b), b.assetId);
      const aVal = balanceSortValue(aEntry?.formatted, aEntry?.status);
      const bVal = balanceSortValue(bEntry?.formatted, bEntry?.status);
      if (bVal !== aVal) return bVal - aVal;
      return a.chain.chainName.localeCompare(b.chain.chainName);
    });
  }, [chainsForSymbol, balances, owners, showBalances, getBalance]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[360px] gap-0 overflow-hidden rounded-[20px] p-0 sm:max-w-[360px]">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="font-montserrat text-[16px] font-medium">
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 px-5 pb-3">
          {SYMBOLS.map((s) => {
            const active = symbol === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSymbol(s)}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-[20px] border px-3 font-montserrat text-[14px] font-medium transition-colors",
                  active
                    ? "border-black bg-black text-white"
                    : "border-black/10 text-black hover:bg-black/5",
                )}
              >
                <img
                  src={tokenLogoUrl(s)}
                  alt=""
                  className="size-5 rounded-full object-cover"
                />
                {s}
              </button>
            );
          })}
        </div>

        <div className="max-h-[360px] overflow-y-auto px-3 pb-4">
          {loading && tokens.length === 0 && (
            <p className="px-2 py-4 font-montserrat text-[13px] text-[#606060]">Loading chains…</p>
          )}
          {!loading && sortedChains.length === 0 && (
            <p className="px-2 py-4 font-montserrat text-[13px] text-[#606060]">
              No chains available for {symbol}
            </p>
          )}
          <ul className="flex flex-col gap-0.5">
            {sortedChains.map((token) => {
              const selected = token.assetId === selectedAssetId;
              const locked = Boolean(
                lockChainKind && token.chain.chainKind !== lockChainKind,
              );
              const tokenOwner = ownerForToken(owners, token);
              const entry = showBalances && tokenOwner
                ? getBalance(tokenOwner, token.assetId)
                : undefined;
              const loadingBalance = showBalances
                && !!tokenOwner
                && (!entry || entry.status === "loading");
              const row = (
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    if (locked) return;
                    onSelect({ token });
                    onOpenChange(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition-colors",
                    locked
                      ? "cursor-not-allowed opacity-40"
                      : "hover:bg-[#f6f6f6]",
                    selected && !locked && "bg-[#f6f6f6]",
                  )}
                >
                  <img
                    src={chainLogoUrl(token.blockchain)}
                    alt=""
                    className="size-6 rounded-[4px] object-cover"
                  />
                  <span className="min-w-0 flex-1 font-montserrat text-[14px] text-black">
                    {token.chain.chainName}
                  </span>
                  {showBalances ? (
                    <span className="shrink-0 font-montserrat text-[13px] text-[#606060]">
                      {!tokenOwner ? (
                        "—"
                      ) : loadingBalance ? (
                        <span
                          className="inline-block size-3.5 animate-spin rounded-full border-2 border-[#606060] border-r-transparent"
                          aria-label="Loading balance"
                        />
                      ) : entry?.status === "success" && entry.formatted != null ? (
                        formatNumber(Number(entry.formatted), { maximumFractionDigits: 2 })
                      ) : (
                        "—"
                      )}
                    </span>
                  ) : null}
                </button>
              );
              return (
                <li key={token.assetId}>
                  {locked && lockChainKind ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="block">{row}</span>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[220px] text-left">
                        Recipient address is on {chainKindLabel(lockChainKind)}; edit the recipient to change chain
                      </TooltipContent>
                    </Tooltip>
                  ) : row}
                </li>
              );
            })}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
