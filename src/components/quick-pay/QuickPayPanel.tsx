import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAddress, type Address, type Hex } from "viem";
import { useSendTransaction, useSwitchChain } from "wagmi";
import { AddRecipientPillButton } from "@/components/AddRecipientPillButton";
import { IdentityAvatar } from "@/components/IdentityAvatar";
import { IconLock } from "@/components/icons/lock";
import { SearchInput } from "@/components/search-input/SearchInput";
import { TokenNetworkDialog } from "@/components/token-network-dialog/TokenNetworkDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getChainByNetwork, networkToChainId } from "@/config/chains";
import { useEvmWalletInfo } from "@/hooks/use-evm-wallet-info";
import { useEmployeesQuery } from "@/hooks/use-pay-api";
import { useTokenBalance } from "@/hooks/use-token-balances";
import useToast from "@/hooks/use-toast";
import { api, type QuickPayMode } from "@/lib/api";
import { formatAddress, formatNumber, formatTokenMinor } from "@/lib/format";
import { chainLogoUrl } from "@/lib/logo";
import { formatQuoteErrorMessage } from "@/lib/quote-error";
import { cn } from "@/lib/utils";
import { useIntentsTokensStore, type IntentsToken } from "@/stores/intents-tokens";
import { enqueueQuickPayCommit } from "@/stores/quick-pay-commit-queue";
import { useQuickPayPrefsStore } from "@/stores/quick-pay-prefs";
import { useTokenBalancesStore } from "@/stores/token-balances";
import { useWallet } from "@/wallet";
import { encodeErc20Transfer } from "@/wallet/evm/transfer";

/** Thrown when balance check already showed a toast; skip inline error UI. */
class BalanceGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BalanceGateError";
  }
}

function parseCompensationInput(raw: string): string | null {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return null;
  if (!/^(0|[1-9]\d*)(\.\d{0,6})?$/.test(cleaned)) return null;
  if (Number(cleaned) <= 0) return null;
  return cleaned;
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
  const wallet = useWallet("evm");
  const walletInfo = useEvmWalletInfo();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: employees = [] } = useEmployeesQuery();
  const ensureFresh = useIntentsTokensStore((s) => s.ensureFresh);
  const findByChainAndSymbol = useIntentsTokensStore((s) => s.findByChainAndSymbol);
  const findByAssetId = useIntentsTokensStore((s) => s.findByAssetId);
  const tokensReady = useIntentsTokensStore((s) => s.tokens.length > 0);
  const savedOriginAssetId = useQuickPayPrefsStore((s) => s.originAssetId);
  const setSavedOriginAssetId = useQuickPayPrefsStore((s) => s.setOriginAssetId);
  const paymentMode = useQuickPayPrefsStore((s) => s.paymentMode);
  const setPaymentMode = useQuickPayPrefsStore((s) => s.setPaymentMode);

  const [employeeId, setEmployeeId] = useState<string | null>(initialEmployeeId);
  const [adhocAddress, setAdhocAddress] = useState<string | null>(null);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [memo, setMemo] = useState("");
  const [compensation, setCompensation] = useState("");
  const [destToken, setDestToken] = useState<IntentsToken | null>(null);
  const [originToken, setOriginToken] = useState<IntentsToken | null>(null);
  const [destDialogOpen, setDestDialogOpen] = useState(false);
  const [originDialogOpen, setOriginDialogOpen] = useState(false);
  const [phase, setPhase] = useState<"idle" | "quoting" | "signing" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();

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
    setError(null);
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

  // Dry preview is for Est. Cost only — do not include memo in the queryKey / body.
  // Memo is attached on the live quote at settle time.
  const dryQuoteQuery = useQuery({
    queryKey: [
      "quick-pay-dry-quote",
      paymentMode,
      employee?.id ?? null,
      adhocAddress,
      originToken?.assetId,
      destToken?.assetId,
      amountForQuote,
    ],
    queryFn: async () => {
      if (!originToken || !amountForQuote) throw new Error("Missing quote inputs");
      if (employee?.id && employee.endpoint) {
        return api.quoteQuickPayDry({
          employeeId: employee.id,
          originAsset: originToken.assetId,
          amount: amountForQuote,
          destinationToken: destToken?.symbol || employee.token,
          destinationNetwork: destToken?.chain.chainName || employee.network,
          mode: paymentMode,
        });
      }
      if (adhocAddress && destToken) {
        return api.quoteQuickPayDry({
          destinationAddress: adhocAddress,
          originAsset: originToken.assetId,
          amount: amountForQuote,
          destinationToken: destToken.symbol as "USDC" | "USDT",
          destinationNetwork: destToken.chain.chainName,
          mode: paymentMode,
        });
      }
      throw new Error("Missing quote inputs");
    },
    enabled: !!originToken && !!amountForQuote && canQuoteDestination,
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

  const ownerAddress = wallet.account?.address ?? null;
  const fetchOneBalance = useTokenBalancesStore((s) => s.fetchOne);
  const originBalance = useTokenBalance(ownerAddress, originToken?.assetId);

  useEffect(() => {
    if (!wallet.isConnected || !ownerAddress || !originToken?.contractAddress) return;
    void fetchOneBalance(ownerAddress, originToken);
    const id = window.setInterval(() => {
      void fetchOneBalance(ownerAddress, originToken);
    }, 20_000);
    return () => window.clearInterval(id);
  }, [wallet.isConnected, ownerAddress, originToken, fetchOneBalance]);

  const settleMutation = useMutation({
    mutationFn: async () => {
      if (!originToken || !amountForQuote || !quote || !destinationAddress) {
        throw new Error("Missing payment inputs");
      }
      if (!employee && (!adhocAddress || !destToken)) {
        throw new Error("Missing payment inputs");
      }
      if (!wallet.isConnected || !wallet.account?.address) {
        wallet.connect();
        throw new Error("Connect your payment wallet first");
      }
      if (!originToken.contractAddress) throw new Error("Origin token has no contract address");
      if (!quote.amountIn) throw new Error("Quote missing deposit details");

      const balance = await fetchOneBalance(wallet.account.address, originToken);
      if (!balance || balance.status !== "success" || balance.raw == null) {
        toast.fail({ title: "Could not read wallet balance" });
        throw new BalanceGateError("Could not read wallet balance");
      }
      if (balance.raw < BigInt(quote.amountIn)) {
        toast.fail({ title: "Insufficient balance" });
        throw new BalanceGateError("Insufficient balance");
      }

      setPhase("quoting");
      setError(null);
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
          mode: paymentMode,
          memo: memoValue,
        })
        : await api.quoteQuickPay({
          destinationAddress: adhocAddress!,
          originAsset: originToken.assetId,
          amount: amountForQuote,
          destinationToken: destToken!.symbol as "USDC" | "USDT",
          destinationNetwork: destToken!.chain.chainName,
          idempotencyKey,
          mode: paymentMode,
          memo: memoValue,
        });
      if (!live.context) throw new Error("Live quote missing commit context");

      const chainId = networkToChainId(originToken.chain.chainName) ?? originToken.chain.chainId;
      const amountLabel = `${amountForQuote} ${destSymbol}`;
      const recipientLabel = employee?.name || formatAddress(adhocAddress || destinationAddress);

      if (paymentMode === "private") {
        const intentPayload = live.intent?.payload;
        if (!intentPayload) throw new Error("Private quote missing intent payload");
        const fundingAddress = live.funding?.depositAddress || live.quote.depositAddress;
        const amountIn = live.funding?.amountIn || live.quote.amountIn;
        const fundingDeadline = live.funding?.deadline || live.quote.deadline;
        if (!fundingAddress || !amountIn) throw new Error("Funding quote missing deposit details");
        if (fundingDeadline && Date.parse(String(fundingDeadline)) <= Date.now()) {
          throw new Error("Funding quote expired; get a fresh quote and try again");
        }

        setPhase("signing");
        const signed = await wallet.signMessage({ message: intentPayload });

        setPhase("sending");
        if (fundingDeadline && Date.parse(String(fundingDeadline)) <= Date.now()) {
          throw new Error("Funding quote expired; get a fresh quote and try again");
        }
        if (chainId && wallet.account.chainId !== chainId) {
          await switchChainAsync({ chainId });
        }
        const data = encodeErc20Transfer(fundingAddress as Address, BigInt(amountIn));
        const hash = await sendTransactionAsync({
          to: originToken.contractAddress as Address,
          data: data as Hex,
          value: 0n,
          chainId: chainId || undefined,
        });
        // Persist locally first so a failed commit can retry after refresh.
        enqueueQuickPayCommit({
          context: live.context,
          txHash: hash,
          signature: signed.signature,
          employeeName: recipientLabel,
          amountLabel,
        });
        return { mode: "private" as QuickPayMode };
      }

      const depositAddress = live.quote.depositAddress;
      const amountIn = live.quote.amountIn;
      if (!depositAddress || !amountIn) throw new Error("Quote missing deposit details");
      if (live.quote.deadline && Date.parse(String(live.quote.deadline)) <= Date.now()) {
        throw new Error("Quote expired; get a fresh quote and try again");
      }

      setPhase("sending");
      if (chainId && wallet.account.chainId !== chainId) {
        await switchChainAsync({ chainId });
      }
      const data = encodeErc20Transfer(depositAddress as Address, BigInt(amountIn));
      const hash = await sendTransactionAsync({
        to: originToken.contractAddress as Address,
        data: data as Hex,
        value: 0n,
        chainId: chainId || undefined,
      });
      enqueueQuickPayCommit({
        context: live.context,
        txHash: hash,
        employeeName: recipientLabel,
        amountLabel,
      });
      return { mode: "standard" as QuickPayMode };
    },
    onSuccess: async () => {
      setPhase("done");
      setMemo("");
      toast.success({ title: "Payment submitted" });
      await queryClient.invalidateQueries({ queryKey: ["pending-payments"] });
      await queryClient.invalidateQueries({ queryKey: ["pay-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["org-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["org-payments"] });
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      // Release the button so the admin can start another payment.
      setTimeout(() => setPhase("idle"), 1500);
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
          <div className="inline-flex rounded-[20px] border border-black/10 bg-white p-0.5">
            {([
              { id: "private" as const, label: "Private" },
              { id: "standard" as const, label: "Standard" },
            ]).map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={busy}
                onClick={() => {
                  setPaymentMode(option.id);
                  setPhase("idle");
                  setError(null);
                }}
                className={cn(
                  "rounded-[18px] px-3 py-1 font-montserrat text-[12px] font-medium transition-colors",
                  paymentMode === option.id
                    ? "bg-black text-white"
                    : "text-[#606060] hover:bg-black/5",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-4 flex justify-end">
          <div className="inline-flex rounded-[20px] border border-black/10 bg-white p-0.5">
            {([
              { id: "private" as const, label: "Private" },
              { id: "standard" as const, label: "Standard" },
            ]).map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={busy}
                onClick={() => {
                  setPaymentMode(option.id);
                  setPhase("idle");
                  setError(null);
                }}
                className={cn(
                  "rounded-[18px] px-3 py-1 font-montserrat text-[12px] font-medium transition-colors",
                  paymentMode === option.id
                    ? "bg-black text-white"
                    : "text-[#606060] hover:bg-black/5",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

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
                      setError(null);
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
          {originBalance?.status === "loading" ? (
            <span
              className="inline-block size-3 animate-spin rounded-full border-2 border-[#0e3616] border-r-transparent align-middle"
              aria-label="Loading balance"
            />
          ) : originBalance?.status === "success" && originBalance.formatted != null ? (
            formatNumber(Number(originBalance.formatted), { maximumFractionDigits: 2 })
          ) : (
            "—"
          )}
        </span>
      </p>
      <div className="mb-4 border-b border-black/10" />

      {/* Est. Cost row */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 font-montserrat text-[12px]">
          <span className="text-[#70788a]">Est. Cost</span>
          <span className="text-[#444c59]">
            {amountInDisplay !== "—" && originToken
              ? `${amountInDisplay} ${originToken.symbol}`
              : "—"}
          </span>
          {paymentMode === "private" ? (
            <span className="inline-flex h-[26px] items-center gap-1.5 rounded-[13px] border border-[#d0f348] bg-[rgba(208,243,72,0.2)] px-2.5 font-montserrat text-[12px] font-medium text-[#84a20f]">
              <IconLock className="size-3" />
              Private by default
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-3 font-space-grotesk text-[12px] text-[#444c59]">
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
          || quoting
          || !!quoteError
          || !quote
        }
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
            : phase === "signing"
              ? "Sign intent…"
              : phase === "sending"
                ? "Confirm in wallet…"
                : "Review & Sign"
          : "Review & Sign"}
      </button>

      {error ? (
        <p className="mt-3 font-montserrat text-[13px] text-red-600">{error}</p>
      ) : quoteError && !busy && phase !== "done" ? (
        <p className="mt-3 font-montserrat text-[13px] text-red-600">{quoteError}</p>
      ) : null}
      {phase === "done" ? (
        <p className="mt-3 font-montserrat text-[13px] text-[#0ed000]">Payment submitted. Track progress in Pending Payments.</p>
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
        showBalances
        onSelect={({ token }) => {
          setOriginToken(token);
          setSavedOriginAssetId(token.assetId);
          if (wallet.account?.address) {
            void fetchOneBalance(wallet.account.address, token);
          }
        }}
      />
    </section>
  );
}
