import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { chainLogoUrl, tokenLogoUrl } from "@/lib/logo";
import { cn } from "@/lib/utils";
import {
  useIntentsTokensStore,
  type IntentsToken,
  type StableSymbol,
} from "@/stores/intents-tokens";

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
  onSelect: (selection: TokenNetworkSelection) => void;
}

const SYMBOLS: StableSymbol[] = ["USDT", "USDC"];

export function TokenNetworkDialog({
  open,
  onOpenChange,
  title = "Select token",
  initialSymbol = "USDC",
  selectedAssetId,
  onSelect,
}: TokenNetworkDialogProps) {
  const ensureFresh = useIntentsTokensStore((s) => s.ensureFresh);
  const tokens = useIntentsTokensStore((s) => s.tokens);
  const loading = useIntentsTokensStore((s) => s.loading);
  const [symbol, setSymbol] = useState<StableSymbol>(initialSymbol);

  useEffect(() => {
    if (open) {
      void ensureFresh();
      setSymbol(initialSymbol);
    }
  }, [open, ensureFresh, initialSymbol]);

  const chainsForSymbol = useMemo(() => {
    return tokens
      .filter((t) => t.symbol === symbol)
      .slice()
      .sort((a, b) => a.chain.chainName.localeCompare(b.chain.chainName));
  }, [tokens, symbol]);

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
          {!loading && chainsForSymbol.length === 0 && (
            <p className="px-2 py-4 font-montserrat text-[13px] text-[#606060]">
              No chains available for {symbol}
            </p>
          )}
          <ul className="flex flex-col gap-0.5">
            {chainsForSymbol.map((token) => {
              const selected = token.assetId === selectedAssetId;
              return (
                <li key={token.assetId}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect({ token });
                      onOpenChange(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition-colors hover:bg-[#f6f6f6]",
                      selected && "bg-[#f6f6f6]",
                    )}
                  >
                    <img
                      src={chainLogoUrl(token.blockchain)}
                      alt=""
                      className="size-6 rounded-[4px] object-cover"
                    />
                    <span className="font-montserrat text-[14px] text-black">
                      {token.chain.chainName}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
