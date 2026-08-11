import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Address, type Hex } from "viem";
import { useSendTransaction, useSwitchChain } from "wagmi";
import { IdentityAvatar } from "@/components/IdentityAvatar";
import { TokenNetworkDialog } from "@/components/token-network-dialog/TokenNetworkDialog";
import { getChainByNetwork, networkToChainId } from "@/config/chains";
import { useEvmWalletInfo } from "@/hooks/use-evm-wallet-info";
import { useEmployeesQuery } from "@/hooks/use-pay-api";
import useToast from "@/hooks/use-toast";
import { api, type QuickPayMode } from "@/lib/api";
import { formatAddress, formatNumber, formatTokenMinor } from "@/lib/format";
import { chainLogoUrl, routeLogoUrl } from "@/lib/logo";
import { formatQuoteErrorMessage } from "@/lib/quote-error";
import { cn } from "@/lib/utils";
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
  /** Hide the "Quick Pay" heading (e.g. when embedded in Pay Now dialog). */
  hideTitle?: boolean;
  /** Lock recipient — no capsule picker. */
  recipientLocked?: boolean;
  /** Centered compensation block; destination token shown without picker. */
  compensationLayout?: "row" | "centered";
  /** Prevent changing destination token/network. */
  destinationTokenLocked?: boolean;
}

export function QuickPayPanel({
  className,
  initialEmployeeId = null,
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
  const ensureFresh = useIntentsTokensStore((s) => s.ensureFresh);
  const findByChainAndSymbol = useIntentsTokensStore((s) => s.findByChainAndSymbol);
  const findByAssetId = useIntentsTokensStore((s) => s.findByAssetId);
  const tokensReady = useIntentsTokensStore((s) => s.tokens.length > 0);
  const savedOriginAssetId = useQuickPayPrefsStore((s) => s.originAssetId);
  const setSavedOriginAssetId = useQuickPayPrefsStore((s) => s.setOriginAssetId);
  const paymentMode = useQuickPayPrefsStore((s) => s.paymentMode);
  const setPaymentMode = useQuickPayPrefsStore((s) => s.setPaymentMode);

  const [employeeId, setEmployeeId] = useState<string | null>(initialEmployeeId);
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
      paymentMode,
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
        mode: paymentMode,
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
        mode: paymentMode,
      });

      const chainId = networkToChainId(originToken.chain.chainName) ?? originToken.chain.chainId;

      if (paymentMode === "private") {
        const intentPayload = live.intent?.payload;
        if (!intentPayload) throw new Error("Private quote missing intent payload");

        setPhase("signing");
        const signed = await wallet.signMessage({ message: intentPayload });
        const funded = await api.submitPrivateSignature(live.attempt.id, signed.signature);
        const fundingAddress = funded.funding.depositAddress;
        const amountIn = funded.funding.amountIn;
        if (!fundingAddress || !amountIn) throw new Error("Funding quote missing deposit details");

        setPhase("sending");
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
        await api.submitPrivateDeposit(live.attempt.id, hash);
        return { attemptId: live.attempt.id, mode: "private" as QuickPayMode };
      }

      const depositAddress = live.quote.depositAddress || live.attempt.deposit_address;
      const amountIn = live.quote.amountIn;
      if (!depositAddress || !amountIn) throw new Error("Quote missing deposit details");

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
      await api.submitPaymentDeposit(live.attempt.id, hash);
      return { attemptId: live.attempt.id, mode: "standard" as QuickPayMode };
    },
    onSuccess: async () => {
      setPhase("done");
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
        <div className="mb-5">
          <p className="mb-3 font-montserrat text-[14px] font-medium text-[#606060]">Recipient</p>
          {employees.length === 0 ? (
            <p className="font-montserrat text-[14px] text-[#606060]">No recipients</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {employees.map((emp) => {
                const selected = employeeId === emp.id;
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => {
                      setEmployeeId(emp.id);
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
                    <IdentityAvatar seed={emp.email || emp.name} size={26} alt="" />
                    <span className="max-w-[140px] truncate">{emp.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
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
          {paymentMode === "private" ? (
            <span className="rounded-full bg-black/5 px-2 py-0.5 text-[#0e3616]">Private</span>
          ) : null}
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
