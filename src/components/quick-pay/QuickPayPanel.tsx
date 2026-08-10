import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Address, type Hex } from "viem";
import { useSendTransaction, useSwitchChain } from "wagmi";
import { IdentityAvatar } from "@/components/IdentityAvatar";
import { IconAlert } from "@/components/icons/alert";
import { IconCheck } from "@/components/icons/check";
import { IconClose } from "@/components/icons/close";
import { TokenNetworkDialog } from "@/components/token-network-dialog/TokenNetworkDialog";
import { getChainByNetwork, networkToChainId } from "@/config/chains";
import { useEvmWalletInfo } from "@/hooks/use-evm-wallet-info";
import { useEmployeesQuery } from "@/hooks/use-pay-api";
import useToast from "@/hooks/use-toast";
import { api, type EmployeePayStatus } from "@/lib/api";
import { formatAddress, formatCurrencyFromMinor, formatNumber, formatTokenMinor } from "@/lib/format";
import { chainLogoUrl, routeLogoUrl, tokenLogoUrl } from "@/lib/logo";
import { formatQuoteErrorMessage } from "@/lib/quote-error";
import { cn } from "@/lib/utils";
import { useDrawerStore } from "@/stores/drawer";
import { useIntentsTokensStore, type IntentsToken } from "@/stores/intents-tokens";
import { useQuickPayPrefsStore } from "@/stores/quick-pay-prefs";
import { useWallet } from "@/wallet";
import { encodeErc20Transfer, readErc20Balance } from "@/wallet/evm/transfer";

/** Thrown when balance check already showed a toast; skip inline error UI. */
class BalanceGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BalanceGateError";
  }
}

function VerifiedBadge({ verified }: { verified: boolean }) {
  if (verified) {
    return (
      <span className="inline-flex h-6 items-center gap-1 rounded-[12px] bg-[#0ed000]/10 px-2 font-montserrat text-[12px] text-[#0ed000]">
        <span className="inline-flex size-3 items-center justify-center rounded-full bg-[#0ed000] text-white">
          <IconCheck className="size-2" />
        </span>
        Verified
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 items-center rounded-[12px] bg-[#aaa]/10 px-2 font-montserrat text-[12px] text-[#aaa]">
      Unverified
    </span>
  );
}

function roleBadgeColor(role: string): string {
  const key = role.toLowerCase();
  if (key.includes("market") || key === "mkt") return "bg-[#e89300]/10 text-[#e89300]";
  if (key.includes("dev")) return "bg-[#4a7dff]/10 text-[#4a7dff]";
  return "bg-black/5 text-[#909090]";
}

function parseCompensationInput(raw: string): string | null {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return null;
  if (!/^(0|[1-9]\d*)(\.\d{0,6})?$/.test(cleaned)) return null;
  return cleaned;
}

export interface QuickPayPanelProps {
  className?: string;
  /** Optional preselected employee id. */
  initialEmployeeId?: string | null;
  monthLabel?: string;
  /** Hide the "Quick Pay" heading (e.g. when embedded in Pay Now dialog). */
  hideTitle?: boolean;
  /** Lock recipient — no Change / clear / empty picker. */
  recipientLocked?: boolean;
  /** Centered compensation block; destination token shown without picker. */
  compensationLayout?: "row" | "centered";
  /** Prevent changing destination token/network. */
  destinationTokenLocked?: boolean;
}

export function QuickPayPanel({
  className,
  initialEmployeeId = null,
  monthLabel,
  hideTitle = false,
  recipientLocked = false,
  compensationLayout = "row",
  destinationTokenLocked = false,
}: QuickPayPanelProps) {
  const wallet = useWallet("evm");
  const walletInfo = useEvmWalletInfo();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: employees = [] } = useEmployeesQuery();
  const openRecipientPicker = useDrawerStore((s) => s.openRecipientPicker);
  const ensureFresh = useIntentsTokensStore((s) => s.ensureFresh);
  const findByChainAndSymbol = useIntentsTokensStore((s) => s.findByChainAndSymbol);
  const findByAssetId = useIntentsTokensStore((s) => s.findByAssetId);
  const tokensReady = useIntentsTokensStore((s) => s.tokens.length > 0);
  const savedOriginAssetId = useQuickPayPrefsStore((s) => s.originAssetId);
  const setSavedOriginAssetId = useQuickPayPrefsStore((s) => s.setOriginAssetId);

  const [employeeId, setEmployeeId] = useState<string | null>(initialEmployeeId);
  const [compensation, setCompensation] = useState("");
  const [destToken, setDestToken] = useState<IntentsToken | null>(null);
  const [originToken, setOriginToken] = useState<IntentsToken | null>(null);
  const [destDialogOpen, setDestDialogOpen] = useState(false);
  const [originDialogOpen, setOriginDialogOpen] = useState(false);
  const [phase, setPhase] = useState<"idle" | "quoting" | "sending" | "settling" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [liveAttemptId, setLiveAttemptId] = useState<string | null>(null);

  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();

  useEffect(() => {
    void ensureFresh();
  }, [ensureFresh]);

  useEffect(() => {
    if (initialEmployeeId) setEmployeeId(initialEmployeeId);
  }, [initialEmployeeId]);

  const employee = useMemo(
    () => employees.find((e) => e.id === employeeId) || null,
    [employees, employeeId],
  );

  useEffect(() => {
    if (!employee) return;
    setCompensation(formatTokenMinor(employee.amount_minor, { maximumFractionDigits: 6 }).replace(/,/g, ""));
    const chain = getChainByNetwork(employee.network);
    if (chain) {
      const dest = findByChainAndSymbol(chain.blockchain, employee.token);
      if (dest) setDestToken(dest);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.id, findByChainAndSymbol]);

  // You Pay origin: restore the locally saved preference once tokens load,
  // falling back to eth USDT / base USDC / arb USDT.
  useEffect(() => {
    if (originToken || !tokensReady) return;
    const saved = savedOriginAssetId ? findByAssetId(savedOriginAssetId) : undefined;
    const initial = saved
      || findByChainAndSymbol("eth", "USDT")
      || findByChainAndSymbol("base", "USDC")
      || findByChainAndSymbol("arb", "USDT");
    if (initial) setOriginToken(initial);
  }, [originToken, tokensReady, savedOriginAssetId, findByAssetId, findByChainAndSymbol]);

  const amountForQuote = parseCompensationInput(compensation);

  const dryQuoteQuery = useQuery({
    queryKey: [
      "quick-pay-dry-quote",
      employee?.id,
      originToken?.assetId,
      destToken?.assetId,
      amountForQuote,
    ],
    queryFn: async () => {
      if (!employee || !originToken || !amountForQuote) throw new Error("Missing quote inputs");
      return api.quoteEmployeePaymentDry(employee.id, {
        originAsset: originToken.assetId,
        amount: amountForQuote,
        destinationToken: destToken?.symbol || employee.token,
        destinationNetwork: destToken?.chain.chainName || employee.network,
      });
    },
    enabled: !!employee && !!originToken && !!amountForQuote && !!employee.payout_verified_at,
    refetchInterval: 60_000,
    retry: 1,
  });

  const quote = dryQuoteQuery.data?.quote;
  const quoting = dryQuoteQuery.isFetching;
  const quoteError = dryQuoteQuery.isError
    ? formatQuoteErrorMessage(dryQuoteQuery.error, originToken?.decimals ?? 6)
    : null;
  const amountInDisplay = quote?.amountIn && originToken
    ? formatNumber(Number(quote.amountIn) / 10 ** originToken.decimals, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6,
    })
    : "—";

  const balanceQuery = useQuery({
    queryKey: ["erc20-balance", wallet.account?.address, originToken?.assetId],
    queryFn: async () => {
      if (!wallet.account?.address || !originToken?.contractAddress) return null;
      return readErc20Balance({
        network: originToken.blockchain,
        tokenAddress: originToken.contractAddress as Address,
        owner: wallet.account.address as Address,
        decimals: originToken.decimals,
      });
    },
    enabled: !!wallet.isConnected && !!originToken?.contractAddress && !!wallet.account?.address,
    staleTime: 0,
    refetchInterval: 20_000,
  });

  const payStatus = (employee?.payStatus || "none") as EmployeePayStatus;
  const verified = !!employee?.payout_verified_at && employee.status === "ready";

  const settleMutation = useMutation({
    mutationFn: async () => {
      if (!employee || !originToken || !amountForQuote || !quote) {
        throw new Error("Missing payment inputs");
      }
      if (!wallet.isConnected || !wallet.account?.address) {
        wallet.connect();
        throw new Error("Connect your payment wallet first");
      }
      if (!originToken.contractAddress) throw new Error("Origin token has no contract address");
      if (!verified) throw new Error("Recipient wallet is not verified");
      if (!quote.amountIn) throw new Error("Quote missing deposit details");

      const { data: balance, error: balanceError } = await balanceQuery.refetch();
      if (balanceError || !balance) {
        toast.fail({ title: "Could not read wallet balance" });
        throw new BalanceGateError("Could not read wallet balance");
      }
      if (balance.raw < BigInt(quote.amountIn)) {
        toast.fail({ title: "Insufficient balance" });
        throw new BalanceGateError("Insufficient balance");
      }

      setPhase("quoting");
      setError(null);
      const idempotencyKey = `qp_${employee.id}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
      const live = await api.quoteEmployeePayment(employee.id, {
        originAsset: originToken.assetId,
        amount: amountForQuote,
        destinationToken: destToken?.symbol || employee.token,
        destinationNetwork: destToken?.chain.chainName || employee.network,
        idempotencyKey,
      });
      const depositAddress = live.quote.depositAddress || live.attempt.deposit_address;
      const amountIn = live.quote.amountIn;
      if (!depositAddress || !amountIn) throw new Error("Quote missing deposit details");
      setLiveAttemptId(live.attempt.id);

      setPhase("sending");
      const chainId = networkToChainId(originToken.chain.chainName) ?? originToken.chain.chainId;
      if (chainId && wallet.account.chainId !== chainId) {
        await switchChainAsync({ chainId });
      }
      const amountWei = BigInt(amountIn);
      const data = encodeErc20Transfer(depositAddress as Address, amountWei);
      const hash = await sendTransactionAsync({
        to: originToken.contractAddress as Address,
        data: data as Hex,
        value: 0n,
        chainId: chainId || undefined,
      });

      setPhase("settling");
      await api.submitPaymentDeposit(live.attempt.id, hash);

      // Poll reconcile until terminal.
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const { attempt } = await api.reconcilePaymentAttempt(live.attempt.id);
        if (["confirmed", "failed", "refunded"].includes(attempt.state)) {
          if (attempt.state !== "confirmed") {
            throw new Error(attempt.last_error || `Payment ${attempt.state}`);
          }
          return attempt;
        }
      }
      throw new Error("Payment is still processing; check Payment History later");
    },
    onSuccess: async () => {
      setPhase("done");
      await queryClient.invalidateQueries({ queryKey: ["pay-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (err) => {
      if (err instanceof BalanceGateError) {
        setPhase("idle");
        return;
      }
      setPhase("error");
      setError(formatQuoteErrorMessage(err, originToken?.decimals ?? 6));
    },
  });

  const feeUsd = useMemo(() => {
    if (!quote || !originToken) return null;
    const inAmt = Number(quote.amountIn) / 10 ** originToken.decimals;
    const outAmt = Number(quote.amountOut) / 10 ** (destToken?.decimals ?? 6);
    const delta = Math.max(0, inAmt - outAmt);
    if (!Number.isFinite(delta)) return null;
    return formatNumber(delta, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, [quote, originToken, destToken]);

  const timeEstimate = quote?.timeEstimate
    ? `~${quote.timeEstimate}s`
    : null;

  // isPending covers balance gate + live settle so the button locks immediately on click.
  const busy = settleMutation.isPending;

  return (
    <section
      className={cn(
        "rounded-[20px] border border-white bg-[#fdfdfd] p-5 shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)] sm:p-6",
        className,
      )}
    >
      {!hideTitle ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-montserrat text-[20px] font-medium capitalize text-black">Quick Pay</h2>
        </div>
      ) : null}

      {recipientLocked ? (
        employee ? (
          <div className="mb-5 flex items-center gap-3">
            <IdentityAvatar seed={employee.email || employee.name} size={32} alt="" />
            <p className="min-w-0 flex-1 truncate font-montserrat text-[16px] font-medium text-black">
              {employee.name}
            </p>
            <p className="shrink-0 font-montserrat text-[14px] font-medium text-black">
              {employee.endpoint ? formatAddress(employee.endpoint) : "—"}
            </p>
          </div>
        ) : (
          <div className="mb-5 font-montserrat text-[14px] text-[#606060]">Recipient unavailable</div>
        )
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="font-montserrat text-[14px] font-medium text-[#606060]">Recipient</p>
            <button
              type="button"
              onClick={() =>
                openRecipientPicker({
                  selectedId: employeeId,
                  onSelect: (id) => {
                    setEmployeeId(id);
                    setPhase("idle");
                    setError(null);
                    setLiveAttemptId(null);
                  },
                })
              }
              className="inline-flex h-9 items-center gap-2 rounded-[18px] border border-black/10 px-4 font-montserrat text-[14px] font-medium text-black transition-colors hover:bg-black/5"
            >
              Change
              <img src="/icons/to-down.svg" alt="" className="size-2.5 opacity-60" />
            </button>
          </div>

          {employee ? (
            <div className="relative mb-5 rounded-[12px] border border-white bg-[#fdfdfd] p-4 shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)]">
              <button
                type="button"
                aria-label="Clear recipient"
                onClick={() => {
                  setEmployeeId(null);
                  setPhase("idle");
                  setError(null);
                }}
                className="absolute top-3 right-3 rounded p-1 text-black/50 transition-colors hover:bg-black/5 hover:text-black"
              >
                <IconClose className="size-3" />
              </button>
              <div className="flex gap-3 pr-6">
                <IdentityAvatar seed={employee.email || employee.name} size={56} alt="" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-montserrat text-[16px] font-medium text-black">{employee.name}</p>
                    <span className="ml-auto font-montserrat text-[16px] font-medium text-black">
                      {formatCurrencyFromMinor(employee.amount_minor)} /{" "}
                      {employee.employee_type === "contractor" ? "period" : "month"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {employee.role_title ? (
                      <span className={cn("inline-flex h-6 items-center rounded-[12px] px-2 font-montserrat text-[12px]", roleBadgeColor(employee.role_title))}>
                        {employee.role_title.length > 8 ? employee.role_title.slice(0, 3).toUpperCase() : employee.role_title}
                      </span>
                    ) : null}
                    <span className="inline-flex h-6 items-center rounded-[12px] border border-black/10 px-2 font-montserrat text-[12px] text-[#909090]">
                      {employee.employee_type === "contractor" ? "Contractor" : "Employee"}
                    </span>
                    <VerifiedBadge verified={verified} />
                  </div>
                  {payStatus === "to_be_paid" && (
                    <div className="mt-3 inline-flex h-[30px] items-center gap-2 rounded-[25px] bg-[#9a7bff] px-3 font-montserrat text-[14px] font-medium text-white">
                      <IconAlert className="size-3 text-white" />
                      {monthLabel || "Current"} payroll is to be paid
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() =>
                openRecipientPicker({
                  onSelect: (id) => setEmployeeId(id),
                })
              }
              className="mb-5 flex h-[88px] w-full items-center justify-center rounded-[12px] border border-dashed border-black/15 bg-[#fafafa] font-montserrat text-[14px] text-[#606060] transition-colors hover:bg-[#f0f0f0]"
            >
              Select a recipient
            </button>
          )}
        </>
      )}

      {/* Compensation */}
      {compensationLayout === "centered" ? (
        <div className="mb-5 border-b border-black/10 pb-5 text-center">
          <p className="font-montserrat text-[14px] font-medium text-[#606060]">Compensation</p>
          <input
            value={compensation}
            onChange={(e) => setCompensation(e.target.value)}
            inputMode="decimal"
            placeholder="0"
            className="mt-2 w-full bg-transparent text-center font-montserrat text-[26px] font-medium text-black outline-none"
          />
          <div className="mt-2 inline-flex items-center justify-center gap-2 font-montserrat text-[14px] font-medium text-black">
            {destToken ? (
              <>
                <span className="relative size-5">
                  <img src={destToken.logo} alt="" className="size-5 rounded-full object-cover" />
                  <img
                    src={chainLogoUrl(destToken.blockchain)}
                    alt=""
                    className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-[2px] border border-white object-cover"
                  />
                </span>
                {destToken.symbol}
              </>
            ) : (
              employee?.token || "—"
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="mb-1 flex items-center justify-between">
            <p className="font-montserrat text-[14px] font-medium text-[#606060]">Compensation</p>
            <p className="font-montserrat text-[12px] text-[#606060]">
              {employee?.endpoint ? formatAddress(employee.endpoint) : "—"}
            </p>
          </div>
          <div className="mb-4 flex items-end justify-between gap-3 border-b border-black/10 pb-3">
            <input
              value={compensation}
              onChange={(e) => setCompensation(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              className="w-full min-w-0 bg-transparent font-montserrat text-[26px] font-medium text-black outline-none"
            />
            {destinationTokenLocked ? (
              <div className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[18px] border border-black/10 px-3 font-montserrat text-[14px] font-medium text-black">
                {destToken ? (
                  <>
                    <span className="relative size-5">
                      <img src={destToken.logo} alt="" className="size-5 rounded-full object-cover" />
                      <img
                        src={chainLogoUrl(destToken.blockchain)}
                        alt=""
                        className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-[2px] border border-white object-cover"
                      />
                    </span>
                    {destToken.symbol}
                  </>
                ) : (
                  "Token"
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setDestDialogOpen(true)}
                disabled={!employee}
                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[18px] border border-black/10 px-3 font-montserrat text-[14px] font-medium text-black transition-colors hover:bg-black/5 disabled:opacity-40"
              >
                {destToken ? (
                  <>
                    <span className="relative size-5">
                      <img src={destToken.logo} alt="" className="size-5 rounded-full object-cover" />
                      <img
                        src={chainLogoUrl(destToken.blockchain)}
                        alt=""
                        className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-[2px] border border-white object-cover"
                      />
                    </span>
                    {destToken.symbol}
                  </>
                ) : (
                  "Token"
                )}
                <img src="/icons/to-down.svg" alt="" className="size-2.5 opacity-60" />
              </button>
            )}
          </div>
        </>
      )}

      {/* You Pay */}
      <div className="mb-1 flex items-center justify-between">
        <p className="font-montserrat text-[14px] font-medium text-[#606060]">You Pay</p>
        <div className="flex items-center gap-1.5">
          {wallet.isConnected && walletInfo.icon ? (
            <img src={walletInfo.icon} alt="" className="size-3 rounded-[2px] object-cover" />
          ) : null}
          {wallet.isConnected && wallet.account?.address ? (
            <p className="font-montserrat text-[12px] text-[#606060]">
              {formatAddress(wallet.account.address)}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => wallet.connect()}
              className="font-montserrat text-[12px] text-black underline-offset-2 hover:underline"
            >
              Connect wallet
            </button>
          )}
        </div>
      </div>
      <div className="mb-1 flex items-end justify-between gap-3">
        <p className="font-montserrat text-[16px] font-medium text-black">{amountInDisplay}</p>
        <button
          type="button"
          onClick={() => setOriginDialogOpen(true)}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[18px] border border-black/10 px-3 font-montserrat text-[14px] font-medium text-black transition-colors hover:bg-black/5"
        >
          {originToken ? (
            <>
              <span className="relative size-5">
                <img src={originToken.logo} alt="" className="size-5 rounded-full object-cover" />
                <img
                  src={chainLogoUrl(originToken.blockchain)}
                  alt=""
                  className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-[2px] border border-white object-cover"
                />
              </span>
              {originToken.symbol}
            </>
          ) : (
            "Token"
          )}
          <img src="/icons/to-down.svg" alt="" className="size-2.5 opacity-60" />
        </button>
      </div>
      <p className="mb-4 font-space-grotesk text-[12px]">
        <span className="text-[#9fa7ba]">Balance: </span>
        <span className="text-[#0e3616]">
          {balanceQuery.data
            ? formatNumber(Number(balanceQuery.data.formatted), { maximumFractionDigits: 2 })
            : "—"}
        </span>
      </p>
      <div className="mb-4 border-b border-black/10" />

      {/* Est. Cost row */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-montserrat text-[12px]">
          <span className="text-[#70788a]">Est. Cost</span>
          <span className="text-[#444c59]">
            {amountInDisplay !== "—" && originToken
              ? `${amountInDisplay} ${originToken.symbol}`
              : "—"}
          </span>
        </div>
        <div className="flex items-center gap-3 font-space-grotesk text-[12px] text-[#444c59]">
          {originToken && destToken ? (
            <span className="inline-flex items-center gap-1">
              <img src={routeLogoUrl("logo-near-intents-simple.svg")} alt="" className="ml-2 size-3.5 object-contain" />
            </span>
          ) : null}
          {feeUsd != null ? (
            <span className="inline-flex items-center gap-1">
              <img src="/icons/fee.svg" alt="" className="size-3.5" />
              ${feeUsd}
            </span>
          ) : null}
          {timeEstimate ? (
            <span className="inline-flex items-center gap-1">
              <img src="/icons/duration.svg" alt="" className="size-3.5" />
              {timeEstimate}
            </span>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        disabled={!employee || !originToken || !amountForQuote || busy || !verified || quoting || !!quoteError || !quote}
        onClick={() => {
          setError(null);
          settleMutation.mutate();
        }}
        className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-[12px] bg-black font-montserrat text-[16px] font-medium text-white shadow-[0px_0px_6px_0px_rgba(0,0,0,0.06)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy || quoting ? (
          <span className="size-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
        ) : null}
        {busy
          ? phase === "quoting"
            ? "Getting quote…"
            : phase === "sending"
              ? "Confirm in wallet…"
              : phase === "settling"
                ? "Settling…"
                : "Review & Sign"
          : "Review & Sign"}
      </button>

      {error ? (
        <p className="mt-3 font-montserrat text-[13px] text-red-600">{error}</p>
      ) : quoteError && !busy && phase !== "done" ? (
        <p className="mt-3 font-montserrat text-[13px] text-red-600">{quoteError}</p>
      ) : null}
      {phase === "done" ? (
        <p className="mt-3 font-montserrat text-[13px] text-[#0ed000]">Payment confirmed{liveAttemptId ? "." : ""}</p>
      ) : null}

      <TokenNetworkDialog
        open={destDialogOpen}
        onOpenChange={setDestDialogOpen}
        title="Recipient token"
        initialSymbol={(destToken?.symbol || employee?.token || "USDC") as "USDC" | "USDT"}
        selectedAssetId={destToken?.assetId}
        onSelect={({ token }) => setDestToken(token)}
      />
      <TokenNetworkDialog
        open={originDialogOpen}
        onOpenChange={setOriginDialogOpen}
        title="You pay with"
        initialSymbol={(originToken?.symbol || "USDT") as "USDC" | "USDT"}
        selectedAssetId={originToken?.assetId}
        onSelect={({ token }) => {
          setOriginToken(token);
          setSavedOriginAssetId(token.assetId);
          void queryClient.invalidateQueries({
            queryKey: ["erc20-balance", wallet.account?.address, token.assetId],
          });
        }}
      />
    </section>
  );
}
