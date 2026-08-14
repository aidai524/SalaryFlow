import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAddress, type Address, type Hex } from "viem";
import { useSendTransaction, useSwitchChain } from "wagmi";
import { AddRecipientPillButton } from "@/components/AddRecipientPillButton";
import { BatchPayoutButton } from "@/components/batch-payout/BatchPayoutButton";
import { IdentityAvatar } from "@/components/IdentityAvatar";
import { SearchInput } from "@/components/search-input/SearchInput";
import { TokenNetworkDialog } from "@/components/token-network-dialog/TokenNetworkDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getChainByNetwork, networkToChainId } from "@/config/chains";
import { EstCostRow } from "@/components/you-pay/EstCostRow";
import { YouPaySection } from "@/components/you-pay/YouPaySection";
import { usePayOriginToken } from "@/hooks/use-pay-origin-token";
import { usePaymentWallet } from "@/hooks/use-payment-wallet";
import { useEmployeesQuery } from "@/hooks/use-pay-api";
import useToast from "@/hooks/use-toast";
import { parsePositiveDecimal } from "@/lib/amount-input";
import { api, type QuickPayMode } from "@/lib/api";
import { formatAddress, formatNumber, formatTokenMinor } from "@/lib/format";
import { chainLogoUrl } from "@/lib/logo";
import { formatQuoteErrorMessage } from "@/lib/quote-error";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { useIntentsTokensStore, type IntentsToken } from "@/stores/intents-tokens";
import { enqueueQuickPayCommit } from "@/stores/quick-pay-commit-queue";
import { useTokenBalancesStore } from "@/stores/token-balances";
import { encodeErc20Transfer } from "@/wallet/evm/transfer";
import { PRIVATE_POST_SIGN_DELAY_MS, QUICK_PAY_TOAST } from "./config";
import {
  isDryQuoteStale,
  liveQuoteSettleErrorMessage,
  sameEthereumAddress,
  validateLiveQuoteForSettle,
} from "./utils";

/** Thrown when balance check already showed a toast; skip inline error UI. */
class BalanceGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BalanceGateError";
  }
}

function parseCompensationInput(raw: string): string | null {
  return parsePositiveDecimal(raw, 6);
}

/**
 * Quick Pay currently runs standard only. Private | Standard toggle UI is hidden
 * (removed in e8a2b2d4e1acbe74424db708a13e1eea5a3c5b99).
 *
 * KEEP the private settle branch below and backend `mode: "private"` support.
 * To re-enable: set this to `"private"` and restore the mode toggle.
 */
const PAYMENT_MODE: QuickPayMode = "standard";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export interface QuickPayPanelProps {
  className?: string;
  /** Optional preselected employee id. */
  initialEmployeeId?: string | null;
  /** Hide the "Quick Pay" heading (e.g. when embedded in Pay Now dialog). */
  hideTitle?: boolean;
  /** Lock recipient — no capsule picker. */
  recipientLocked?: boolean;
  /** Centered compensation block; destination token shown without picker. */
  compensationLayout?: "row" | "centered";
  /** Prevent changing destination token/network. */
  destinationTokenLocked?: boolean;
  /** Opens Add Recipient dialog from the capsule list (optional wallet prefill). */
  onAddRecipient?: (endpoint?: string) => void;
}

export function QuickPayPanel({
  className,
  initialEmployeeId = null,
  hideTitle = false,
  recipientLocked = false,
  compensationLayout = "row",
  destinationTokenLocked = false,
  onAddRecipient,
}: QuickPayPanelProps) {
  const paymentWallet = usePaymentWallet();
  const wallet = paymentWallet.wallet;
  const walletInfo = paymentWallet.walletInfo;
  const queryClient = useQueryClient();
  const toast = useToast();
  const boundAddress = paymentWallet.boundAddress;
  const { data: employees = [] } = useEmployeesQuery();
  const ensureFresh = useIntentsTokensStore((s) => s.ensureFresh);
  const findByChainAndSymbol = useIntentsTokensStore((s) => s.findByChainAndSymbol);
  const { originToken, setOriginToken } = usePayOriginToken();

  const [employeeId, setEmployeeId] = useState<string | null>(initialEmployeeId);
  const [adhocAddress, setAdhocAddress] = useState<string | null>(null);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [memo, setMemo] = useState("");
  const [compensation, setCompensation] = useState("");
  const [destToken, setDestToken] = useState<IntentsToken | null>(null);
  const [destDialogOpen, setDestDialogOpen] = useState(false);
  const [phase, setPhase] = useState<"idle" | "quoting" | "signing" | "sending" | "done" | "error">("idle");

  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();
  const bindConnectedWallet = paymentWallet.bindConnectedWallet;
  const connectAndBindWallet = paymentWallet.connectAndBindWallet;

  useEffect(() => {
    void ensureFresh();
  }, [ensureFresh]);

  useEffect(() => {
    if (initialEmployeeId) {
      setEmployeeId(initialEmployeeId);
      setAdhocAddress(null);
    }
  }, [initialEmployeeId]);

  const employee = useMemo(
    () => employees.find((e) => e.id === employeeId) || null,
    [employees, employeeId],
  );

  const filteredEmployees = useMemo(() => {
    const q = recipientSearch.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((emp) => {
      const name = (emp.name || "").toLowerCase();
      const endpoint = (emp.endpoint || "").toLowerCase();
      return name.includes(q) || endpoint.includes(q);
    });
  }, [employees, recipientSearch]);

  const pastedAddress = useMemo(() => {
    const raw = recipientSearch.trim();
    if (!raw || !isAddress(raw)) return null;
    return raw as Address;
  }, [recipientSearch]);

  const showEmptyRecipientHint = !recipientLocked
    && recipientSearch.trim().length > 0
    && filteredEmployees.length === 0;

  useEffect(() => {
    if (recipientLocked) return;
    const raw = recipientSearch.trim();
    if (!raw) return;
    if (!pastedAddress) {
      setAdhocAddress(null);
      return;
    }
    const matched = employees.find(
      (emp) => emp.endpoint && emp.endpoint.toLowerCase() === pastedAddress.toLowerCase(),
    );
    if (matched) {
      setEmployeeId(matched.id);
      setAdhocAddress(null);
      return;
    }
    setEmployeeId(null);
    setAdhocAddress(pastedAddress);
    setPhase("idle");
  }, [pastedAddress, recipientSearch, employees, recipientLocked]);

  const destinationAddress = employee?.endpoint || adhocAddress;
  const canQuoteDestination = !!destinationAddress && (!!employee || !!destToken);

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

  const amountForQuote = parseCompensationInput(compensation);
  const debouncedAmountForQuote = useDebouncedValue(amountForQuote, 900);

  // Dry preview is for Est. Cost only — do not include memo in the queryKey / body.
  // Memo is attached on the live quote at settle time.
  const dryQuoteQuery = useQuery({
    queryKey: [
      "quick-pay-dry-quote",
      PAYMENT_MODE,
      employee?.id ?? null,
      adhocAddress,
      originToken?.assetId,
      destToken?.assetId,
      debouncedAmountForQuote,
    ],
    queryFn: async () => {
      if (!originToken || !debouncedAmountForQuote) throw new Error("Missing quote inputs");
      if (employee?.id && employee.endpoint) {
        return api.quoteQuickPayDry({
          employeeId: employee.id,
          originAsset: originToken.assetId,
          amount: debouncedAmountForQuote,
          destinationToken: destToken?.symbol || employee.token,
          destinationNetwork: destToken?.chain.chainName || employee.network,
          mode: PAYMENT_MODE,
        });
      }
      if (adhocAddress && destToken) {
        return api.quoteQuickPayDry({
          destinationAddress: adhocAddress,
          originAsset: originToken.assetId,
          amount: debouncedAmountForQuote,
          destinationToken: destToken.symbol as "USDC" | "USDT",
          destinationNetwork: destToken.chain.chainName,
          mode: PAYMENT_MODE,
        });
      }
      throw new Error("Missing quote inputs");
    },
    enabled: !!originToken && !!debouncedAmountForQuote && canQuoteDestination,
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
    retry: 1,
  });

  const quote = amountForQuote && canQuoteDestination
    ? dryQuoteQuery.data?.quote
    : undefined;
  const dryQuoteStale = isDryQuoteStale({
    amountForQuote,
    debouncedAmountForQuote,
    isPlaceholderData: dryQuoteQuery.isPlaceholderData,
    isPending: dryQuoteQuery.isPending,
    isFetching: dryQuoteQuery.isFetching,
  });
  const quoteError = dryQuoteQuery.isError
    ? formatQuoteErrorMessage(dryQuoteQuery.error, originToken?.decimals ?? 6)
    : null;
  const amountInDisplay = quote?.amountIn && originToken
    ? formatNumber(Number(quote.amountIn) / 10 ** originToken.decimals, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6,
    })
    : "—";

  const fetchOneBalance = useTokenBalancesStore((s) => s.fetchOne);

  const resetForm = () => {
    if (!recipientLocked) {
      setEmployeeId(null);
      setAdhocAddress(null);
      setRecipientSearch("");
    }
    if (!recipientLocked && !destinationTokenLocked) {
      setDestToken(null);
    }
    setCompensation("");
    setMemo("");
    queryClient.removeQueries({ queryKey: ["quick-pay-dry-quote"] });
  };

  const settleMutation = useMutation({
    mutationFn: async () => {
      if (!originToken || !amountForQuote || !quote || !destinationAddress) {
        throw new Error("Missing payment inputs");
      }
      if (!employee && (!adhocAddress || !destToken)) {
        throw new Error("Missing payment inputs");
      }
      if (!useAuthStore.getState().user?.wallet_address) {
        if (wallet.isConnected && wallet.account?.address) {
          await bindConnectedWallet(wallet.account.address);
        } else {
          connectAndBindWallet();
          throw new Error("Connect your payment wallet first");
        }
      }
      if (!wallet.isConnected || !wallet.account?.address) {
        wallet.connect();
        throw new Error("Connect your payment wallet first");
      }
      const paymentWallet = useAuthStore.getState().user?.wallet_address;
      if (!paymentWallet) {
        throw new Error("Connect your payment wallet first");
      }
      if (!sameEthereumAddress(paymentWallet, wallet.account.address)) {
        toast.fail({ title: QUICK_PAY_TOAST.SWITCH_BOUND_WALLET });
        throw new BalanceGateError("Wallet mismatch");
      }
      if (!originToken.contractAddress) throw new Error("Origin token has no contract address");

      setPhase("quoting");
      const memoValue = memo.trim() || null;
      const destSymbol = destToken?.symbol || employee?.token || "USDC";
      const destNetwork = destToken?.chain.chainName || employee?.network || "";
      const idempotencyKey = `qp_${employee?.id || adhocAddress}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
      const live = employee
        ? await api.quoteQuickPay({
          employeeId: employee.id,
          originAsset: originToken.assetId,
          amount: amountForQuote,
          destinationToken: destSymbol,
          destinationNetwork: destNetwork,
          idempotencyKey,
          mode: PAYMENT_MODE,
          memo: memoValue,
        })
        : await api.quoteQuickPay({
          destinationAddress: adhocAddress!,
          originAsset: originToken.assetId,
          amount: amountForQuote,
          destinationToken: destToken!.symbol as "USDC" | "USDT",
          destinationNetwork: destToken!.chain.chainName,
          idempotencyKey,
          mode: PAYMENT_MODE,
          memo: memoValue,
        });
      const chainId = networkToChainId(originToken.chain.chainName) ?? originToken.chain.chainId;
      const amountLabel = `${amountForQuote} ${destSymbol}`;
      const recipientLabel = employee?.name || formatAddress(adhocAddress || destinationAddress);

      // KEEP: private settle (intent sign + fund confidential deposit). Hidden since
      // e8a2b2d4e1acbe74424db708a13e1eea5a3c5b99 — do not delete. Re-enable via PAYMENT_MODE.
      if (PAYMENT_MODE === "private") {
        if (typeof live.context !== "string" || !live.context) {
          throw new Error("Live quote missing commit context");
        }
        const intentPayload = live.intent?.payload;
        if (!intentPayload) throw new Error("Private quote missing intent payload");
        const fundingAddress = live.funding?.depositAddress || live.quote.depositAddress;
        const amountInRaw = live.funding?.amountIn || live.quote.amountIn;
        const fundingDeadline = live.funding?.deadline || live.quote.deadline;
        if (!fundingAddress || !amountInRaw) throw new Error("Funding quote missing deposit details");
        if (fundingDeadline && Date.parse(String(fundingDeadline)) <= Date.now()) {
          throw new Error("Funding quote expired; get a fresh quote and try again");
        }
        const amountIn = BigInt(amountInRaw);

        const privateBalance = await fetchOneBalance(paymentWallet, originToken);
        if (!privateBalance || privateBalance.status !== "success" || privateBalance.raw == null) {
          toast.fail({ title: QUICK_PAY_TOAST.COULD_NOT_READ_BALANCE });
          throw new BalanceGateError("Could not read wallet balance");
        }
        if (privateBalance.raw < amountIn) {
          toast.fail({ title: QUICK_PAY_TOAST.INSUFFICIENT_BALANCE });
          throw new BalanceGateError("Insufficient balance");
        }

        setPhase("signing");
        if (chainId && wallet.account.chainId !== chainId) {
          await switchChainAsync({ chainId });
        }
        const signed = await wallet.signMessage({ message: intentPayload });

        if (fundingDeadline && Date.parse(String(fundingDeadline)) <= Date.now()) {
          throw new Error("Funding quote expired; get a fresh quote and try again");
        }
        await new Promise((r) => setTimeout(r, PRIVATE_POST_SIGN_DELAY_MS));
        if (fundingDeadline && Date.parse(String(fundingDeadline)) <= Date.now()) {
          throw new Error("Funding quote expired; get a fresh quote and try again");
        }

        setPhase("sending");
        const privateData = encodeErc20Transfer(fundingAddress as Address, amountIn);
        const privateHash = await sendTransactionAsync({
          to: originToken.contractAddress as Address,
          data: privateData as Hex,
          value: 0n,
          chainId: chainId || undefined,
        });
        enqueueQuickPayCommit({
          context: live.context,
          txHash: privateHash,
          signature: signed.signature,
          employeeName: recipientLabel,
          amountLabel,
        });
        return { mode: "private" as const };
      }

      const settled = validateLiveQuoteForSettle(live);
      if (!settled.ok) {
        throw new Error(liveQuoteSettleErrorMessage(settled.reason));
      }

      const balance = await fetchOneBalance(paymentWallet, originToken);
      if (!balance || balance.status !== "success" || balance.raw == null) {
        toast.fail({ title: QUICK_PAY_TOAST.COULD_NOT_READ_BALANCE });
        throw new BalanceGateError("Could not read wallet balance");
      }
      if (balance.raw < settled.amountIn) {
        toast.fail({ title: QUICK_PAY_TOAST.INSUFFICIENT_BALANCE });
        throw new BalanceGateError("Insufficient balance");
      }

      setPhase("sending");
      if (chainId && wallet.account.chainId !== chainId) {
        await switchChainAsync({ chainId });
      }
      const data = encodeErc20Transfer(settled.depositAddress as Address, settled.amountIn);
      const hash = await sendTransactionAsync({
        to: originToken.contractAddress as Address,
        data: data as Hex,
        value: 0n,
        chainId: chainId || undefined,
      });
      enqueueQuickPayCommit({
        context: settled.context,
        txHash: hash,
        employeeName: recipientLabel,
        amountLabel,
      });
      return { mode: PAYMENT_MODE };
    },
    onSuccess: () => {
      setPhase("done");
      toast.success({ title: "Payment submitted" });
      resetForm();
      // Fire-and-forget: awaiting these keeps isPending true and the button spinning.
      void queryClient.invalidateQueries({ queryKey: ["pending-payments"] });
      void queryClient.invalidateQueries({ queryKey: ["pay-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["org-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["org-payments"] });
      void queryClient.invalidateQueries({ queryKey: ["employees"] });
      setTimeout(() => setPhase("idle"), 1500);
    },
    onError: (err) => {
      if (err instanceof BalanceGateError) {
        setPhase("idle");
        return;
      }
      setPhase("error");
      toast.fail({
        title: formatQuoteErrorMessage(err, originToken?.decimals ?? 6),
      });
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
  // phase "done" means the tx is already submitted — don't keep spinning while lists refetch.
  const busy = settleMutation.isPending && phase !== "done";
  const showButtonSpinner = busy || (!!amountForQuote && canQuoteDestination && dryQuoteStale);

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
          <BatchPayoutButton />
        </div>
      ) : null}

      {recipientLocked ? (
        employee ? (
          <div className="mb-5 flex items-center gap-3">
            <IdentityAvatar
              seed={employee.email || employee.name}
              src={employee.avatar_url}
              size={32}
              alt=""
            />
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
        <div className="mb-5">
          <p className="mb-3 font-montserrat text-[14px] font-medium text-[#606060]">Recipient</p>
          <SearchInput
            value={recipientSearch}
            onChange={setRecipientSearch}
            placeholder="Search name or paste address..."
            className="w-full"
            inputClassName="h-9 rounded-[18px]"
          />
          {showEmptyRecipientHint ? (
            <p className="mt-[35px] text-center font-montserrat text-[14px] font-normal leading-[200%] text-[#606060]">
              Not listed in recipient yet, you can send directly, or{" "}
              <button
                type="button"
                onClick={() => onAddRecipient?.(pastedAddress || recipientSearch.trim() || undefined)}
                className="text-black underline underline-offset-2"
              >
                add to recipients
              </button>
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {filteredEmployees.map((emp) => {
                const selected = employeeId === emp.id;
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => {
                      setEmployeeId(emp.id);
                      setAdhocAddress(null);
                      setPhase("idle");
                    }}
                    className={cn(
                      "inline-flex h-10 items-center gap-2 rounded-[26px] border px-2.5 pr-3 font-montserrat text-[14px] font-medium transition-colors",
                      selected
                        ? "border-black bg-black text-white"
                        : "border-black/10 bg-transparent text-black hover:bg-black/5",
                    )}
                  >
                    <IdentityAvatar
                      seed={emp.email || emp.name}
                      src={emp.avatar_url}
                      size={26}
                      alt=""
                    />
                    <span className="max-w-[140px] truncate">{emp.name}</span>
                  </button>
                );
              })}
              {adhocAddress && !employee ? (
                <button
                  type="button"
                  className="inline-flex h-10 items-center gap-2 rounded-[26px] border border-black bg-black px-2.5 pr-3 font-montserrat text-[14px] font-medium text-white"
                >
                  <span className="inline-flex size-[26px] items-center justify-center rounded-full bg-white/20 text-[11px]">
                    {adhocAddress.slice(2, 3).toUpperCase()}
                  </span>
                  <span className="max-w-[140px] truncate">{formatAddress(adhocAddress)}</span>
                </button>
              ) : null}
              {onAddRecipient ? (
                <AddRecipientPillButton
                  onClick={() => onAddRecipient(pastedAddress || undefined)}
                />
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Compensation */}
      {compensationLayout === "centered" ? (
        <div className="mb-5 border-b border-black/10 pb-5 text-center">
          <p className="font-montserrat text-[14px] font-medium text-[#606060]">Amount</p>
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
            <p className="font-montserrat text-[14px] font-medium text-[#606060]">Amount</p>
            <p className="font-montserrat text-[12px] text-[#606060]">
              {destinationAddress ? formatAddress(destinationAddress) : "—"}
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
                disabled={!employee && !adhocAddress}
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

      {/* You Pay — show bound account wallet (DB), not browser session alone */}
      <YouPaySection
        amountDisplay={amountInDisplay}
        originToken={originToken}
        onOriginTokenChange={setOriginToken}
        boundAddress={boundAddress}
        walletConnected={wallet.isConnected}
        walletIcon={walletInfo.icon}
        connecting={paymentWallet.bindingWallet || paymentWallet.pendingBind}
        onConnectWallet={connectAndBindWallet}
      />
      <div className="mb-4 border-b border-black/10" />

      <EstCostRow
        amountInDisplay={amountInDisplay}
        originSymbol={originToken?.symbol}
        feeUsd={feeUsd}
        timeEstimate={timeEstimate}
      />

      <div className="mb-6 flex items-center gap-3">
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="font-montserrat text-[14px] font-medium text-[#606060]">Memo</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="inline-flex size-3.5 items-center justify-center" aria-label="Memo help">
                <img src="/icons/question.svg" alt="" className="size-3.5 opacity-60" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-left">
              The memo will be displayed in the history, visible only to you
            </TooltipContent>
          </Tooltip>
        </div>
        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          maxLength={200}
          placeholder="Intention of transfer"
          className="h-9 min-w-0 flex-1 rounded-[6px] border border-[#e3e3e3] bg-[#f6f6f6] px-3 font-montserrat text-[14px] text-black outline-none placeholder:text-black/30 focus:border-black/30"
        />
      </div>

      <button
        type="button"
        disabled={
          !originToken
          || !amountForQuote
          || busy
          || !canQuoteDestination
          || dryQuoteStale
          || !!quoteError
          || !quote
        }
        onClick={() => {
          settleMutation.mutate();
        }}
        className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-[12px] bg-black font-montserrat text-[16px] font-medium text-white shadow-[0px_0px_6px_0px_rgba(0,0,0,0.06)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {showButtonSpinner ? (
          <span className="size-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
        ) : null}
        {busy
          ? phase === "quoting"
            ? "Getting quote…"
            : phase === "signing"
              ? "Sign intent…"
              : phase === "sending"
                ? "Confirm in wallet…"
                : "Review & Sign"
          : "Review & Sign"}
      </button>

      {quoteError && !busy && phase !== "done" ? (
        <p className="mt-3 font-montserrat text-[13px] text-red-600">{quoteError}</p>
      ) : null}

      <TokenNetworkDialog
        open={destDialogOpen}
        onOpenChange={setDestDialogOpen}
        title="Recipient token"
        initialSymbol={(destToken?.symbol || employee?.token || "USDC") as "USDC" | "USDT"}
        selectedAssetId={destToken?.assetId}
        onSelect={({ token }) => setDestToken(token)}
      />
    </section>
  );
}
