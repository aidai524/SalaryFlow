import { useEffect, useMemo, useRef, useState } from "react";
import { encodeFunctionData, type Address, type Hex } from "viem";
import { useSendTransaction, useSwitchChain } from "wagmi";
import { IconClose } from "@/components/icons/close";
import { ResponsiveDialog } from "@/components/responsive-dialog/ResponsiveDialog";
import {
  BATCH_PAYOUT_ABI,
  enabledBatchPayoutBlockchains,
  getBatchPayoutContract,
} from "@/config/batch-payout-chains";
import { networkToChainId } from "@/config/chains";
import { useEmployeesQuery } from "@/hooks/use-pay-api";
import { usePayOriginToken } from "@/hooks/use-pay-origin-token";
import { usePaymentWallet } from "@/hooks/use-payment-wallet";
import useToast from "@/hooks/use-toast";
import { mapPoolSettled } from "@/lib/async-pool";
import { api } from "@/lib/api";
import { parsePositiveDecimal } from "@/lib/amount-input";
import { formatNumber } from "@/lib/format";
import { formatQuoteErrorMessage } from "@/lib/quote-error";
import type { Employee } from "@/lib/api";
import { enqueueBatchPayoutCommit } from "@/stores/batch-payout-commit-queue";
import { useTokenBalancesStore } from "@/stores/token-balances";
import { encodeErc20Approve, readErc20Allowance } from "@/wallet/evm/transfer";
import { PRIVATE_POST_SIGN_DELAY_MS, QUICK_PAY_TOAST } from "@/components/quick-pay/config";
import { sameEthereumAddress } from "@/components/quick-pay/utils";
import { EditAmountsStep } from "./steps/EditAmountsStep";
import { ReviewPayStep } from "./steps/ReviewPayStep";
import { SelectEmployeesStep } from "./steps/SelectEmployeesStep";
import { BATCH_PAYOUT_DIALOG_DESKTOP_CLASSNAME, BATCH_PAYOUT_MAX_ITEMS, BATCH_PAYOUT_TOAST, BATCH_QUOTE_CONCURRENCY } from "./config";
import {
  allDraftsValid,
  asAddress,
  defaultAmountForEmployee,
  makeBatchId,
  minQuoteDeadlineUnix,
  type BatchDraft,
} from "./utils";

const PAYMENT_MODE = "standard" as const;

export function BatchPayoutDialog({
  open,
  onOpenChange,
  initialEmployeeIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEmployeeIds?: string[];
}) {
  const toast = useToast();
  const payWallet = usePaymentWallet();
  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();
  const { data: allEmployees = [] } = useEmployeesQuery();
  const fetchOneBalance = useTokenBalancesStore((s) => s.fetchOne);
  const allowedBlockchains = useMemo(() => enabledBatchPayoutBlockchains(), []);
  const { originToken, setOriginToken } = usePayOriginToken(allowedBlockchains);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Map<string, Employee>>(new Map());
  const [drafts, setDrafts] = useState<BatchDraft[]>([]);
  const [phase, setPhase] = useState<"idle" | "dry" | "live" | "signing" | "done">("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [dryReady, setDryReady] = useState(false);
  const [amountInDisplay, setAmountInDisplay] = useState("—");
  const [feeUsd, setFeeUsd] = useState<string | null>(null);
  const [timeEstimate, setTimeEstimate] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const seededRef = useRef(false);

  useEffect(() => {
    if (!open) {
      seededRef.current = false;
      return;
    }
    setStep(1);
    setPage(1);
    setPhase("idle");
    setDryReady(false);
    setQuoteError(null);
    setAmountInDisplay("—");
    setFeeUsd(null);
    setTimeEstimate(null);
    setProgress({ done: 0, total: 0 });
    setDrafts([]);
    if (!initialEmployeeIds?.length) {
      setSelected(new Map());
      seededRef.current = true;
    }
  }, [open, initialEmployeeIds]);

  useEffect(() => {
    if (!open || seededRef.current || !initialEmployeeIds?.length || allEmployees.length === 0) return;
    const next = new Map<string, Employee>();
    for (const id of initialEmployeeIds) {
      const emp = allEmployees.find((row) => row.id === id);
      if (emp) next.set(emp.id, emp);
    }
    setSelected(next);
    seededRef.current = true;
  }, [open, initialEmployeeIds, allEmployees]);

  const selectedCount = selected.size;

  function toggleEmployee(employee: Employee, next: boolean) {
    setSelected((prev) => {
      const copy = new Map(prev);
      if (next) {
        if (copy.size >= BATCH_PAYOUT_MAX_ITEMS && !copy.has(employee.id)) {
          toast.fail({ title: BATCH_PAYOUT_TOAST.MAX_ITEMS });
          return prev;
        }
        copy.set(employee.id, employee);
      } else {
        copy.delete(employee.id);
      }
      return copy;
    });
    setDryReady(false);
  }

  function togglePage(employees: Employee[], next: boolean) {
    setSelected((prev) => {
      const copy = new Map(prev);
      if (!next) {
        for (const emp of employees) copy.delete(emp.id);
        return copy;
      }
      let hitMax = false;
      for (const emp of employees) {
        if (copy.has(emp.id)) continue;
        if (copy.size >= BATCH_PAYOUT_MAX_ITEMS) {
          hitMax = true;
          break;
        }
        copy.set(emp.id, emp);
      }
      if (hitMax) toast.fail({ title: BATCH_PAYOUT_TOAST.MAX_ITEMS });
      return copy;
    });
    setDryReady(false);
  }

  function resetQuotePreview() {
    setDryReady(false);
    setQuoteError(null);
    setAmountInDisplay("—");
    setFeeUsd(null);
    setTimeEstimate(null);
    setPhase("idle");
  }

  function goBack() {
    if (step === 3) resetQuotePreview();
    setStep((s) => (s === 3 ? 2 : 1));
  }

  function goStep2() {
    const next = [...selected.values()].map((employee) => {
      const existing = drafts.find((row) => row.employee.id === employee.id);
      return {
        employee,
        amount: existing?.amount ?? defaultAmountForEmployee(employee),
        memo: existing?.memo ?? "",
      };
    });
    setDrafts(next);
    setStep(2);
  }

  function updateDraft(employeeId: string, patch: Partial<Pick<BatchDraft, "amount" | "memo">>) {
    setDrafts((prev) => prev.map((row) => (row.employee.id === employeeId ? { ...row, ...patch } : row)));
    setDryReady(false);
  }

  const amountsFingerprint = useMemo(
    () => drafts.map((row) => `${row.employee.id}:${row.amount}:${row.memo}`).join("|"),
    [drafts],
  );

  useEffect(() => {
    setDryReady(false);
    setQuoteError(null);
    setAmountInDisplay("—");
    setFeeUsd(null);
    setTimeEstimate(null);
  }, [originToken?.assetId, amountsFingerprint]);

  async function runQuotes(dry: boolean) {
    if (!originToken) throw new Error("Select a payment token");
    const total = drafts.length;
    setProgress({ done: 0, total });
    const results = await mapPoolSettled(
      drafts,
      async (row) => {
        const amount = parsePositiveDecimal(row.amount);
        if (!amount) throw new Error("Invalid amount");
        const body = {
          employeeId: row.employee.id,
          originAsset: originToken.assetId,
          amount,
          destinationToken: row.employee.token,
          destinationNetwork: row.employee.network,
          mode: PAYMENT_MODE,
          memo: row.memo.trim() || null,
        };
        if (dry) return api.quoteQuickPayDry(body);
        return api.quoteQuickPay({
          ...body,
          idempotencyKey: `bp_${row.employee.id}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
        });
      },
      {
        concurrency: BATCH_QUOTE_CONCURRENCY,
        onProgress: (done) => setProgress({ done, total }),
      },
    );

    const failed = results
      .map((result, index) => ({ result, draft: drafts[index] }))
      .filter((row) => row.result.status === "rejected");
    if (failed.length > 0) {
      const first = failed[0];
      const name = first.draft?.employee.name || "Recipient";
      throw new Error(`${name}: ${formatQuoteErrorMessage(first.result.reason, originToken.decimals)}`);
    }
    return results.map((row) => row.value!);
  }

  async function handleReview() {
    if (!originToken) return;
    setBusy(true);
    setPhase("dry");
    setQuoteError(null);
    try {
      const quotes = await runQuotes(true);
      let inSum = 0n;
      let maxTime = 0;
      for (const item of quotes) {
        const q = "quote" in item ? item.quote : undefined;
        if (!q) continue;
        inSum += BigInt(q.amountIn || "0");
        const t = Number(q.timeEstimate);
        if (Number.isFinite(t) && t > maxTime) maxTime = t;
      }
      const inHuman = Number(inSum) / 10 ** originToken.decimals;
      const outHuman = drafts.reduce((sum, row) => sum + Number(row.amount || 0), 0);
      setAmountInDisplay(formatNumber(inHuman, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 6,
      }));
      setFeeUsd(formatNumber(Math.max(0, inHuman - outHuman), { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      setTimeEstimate(maxTime > 0 ? `~${Math.round(maxTime)}s` : null);
      setDryReady(true);
      setPhase("idle");
    } catch (error) {
      setQuoteError(error instanceof Error ? error.message : "Quote failed");
      setPhase("idle");
    } finally {
      setBusy(false);
    }
  }

  async function handleSign() {
    if (!originToken?.contractAddress) return;
    const contract = getBatchPayoutContract(originToken.blockchain);
    if (!contract) {
      toast.fail({ title: BATCH_PAYOUT_TOAST.NO_CONTRACT });
      return;
    }
    const ready = await payWallet.ensureWalletReady();
    if (!ready || !payWallet.wallet.account?.address) return;
    const payer = payWallet.boundAddress;
    if (!payer || !sameEthereumAddress(payer, payWallet.wallet.account.address)) {
      toast.fail({ title: QUICK_PAY_TOAST.SWITCH_BOUND_WALLET });
      return;
    }

    setBusy(true);
    setPhase("live");
    setQuoteError(null);
    try {
      const lives = await runQuotes(false);
      const tos: Address[] = [];
      const amounts: bigint[] = [];
      const contexts: string[] = [];
      const deadlines: Array<string | null | undefined> = [];
      let totalIn = 0n;
      for (const live of lives) {
        if (!live || !("context" in live) || !live.quote.depositAddress || !live.quote.amountIn) {
          throw new Error("Live quote missing deposit details");
        }
        tos.push(asAddress(live.quote.depositAddress));
        const amt = BigInt(live.quote.amountIn);
        amounts.push(amt);
        totalIn += amt;
        contexts.push(live.context);
        deadlines.push(live.quote.deadline);
      }

      const balance = await fetchOneBalance(payer, originToken);
      if (!balance || balance.status !== "success" || balance.raw == null) {
        toast.fail({ title: QUICK_PAY_TOAST.COULD_NOT_READ_BALANCE });
        throw new Error(QUICK_PAY_TOAST.COULD_NOT_READ_BALANCE);
      }
      if (balance.raw < totalIn) {
        toast.fail({ title: BATCH_PAYOUT_TOAST.INSUFFICIENT_BALANCE });
        throw new Error(BATCH_PAYOUT_TOAST.INSUFFICIENT_BALANCE);
      }

      const chainId = originToken.chain.chainId ?? networkToChainId(originToken.chain.chainName);
      if (chainId && payWallet.wallet.account.chainId !== chainId) {
        await switchChainAsync({ chainId });
      }

      const allowance = await readErc20Allowance({
        network: originToken.blockchain,
        tokenAddress: originToken.contractAddress as Address,
        owner: asAddress(payer),
        spender: contract.address,
      });
      setPhase("signing");
      if (allowance < totalIn) {
        await sendTransactionAsync({
          to: originToken.contractAddress as Address,
          data: encodeErc20Approve(contract.address, totalIn),
          value: 0n,
          chainId: chainId || undefined,
        });
        await new Promise((resolve) => setTimeout(resolve, PRIVATE_POST_SIGN_DELAY_MS));
      }

      const batchId = makeBatchId(tos, originToken.assetId);
      const data = encodeFunctionData({
        abi: BATCH_PAYOUT_ABI,
        functionName: "execute",
        args: [
          originToken.contractAddress as Address,
          tos,
          amounts,
          batchId,
          minQuoteDeadlineUnix(deadlines),
        ],
      });
      const hash = await sendTransactionAsync({
        to: contract.address,
        data,
        value: 0n,
        chainId: chainId || undefined,
      });

      enqueueBatchPayoutCommit({
        batchId,
        txHash: hash as Hex,
        contractAddress: contract.address,
        originToken: originToken.symbol,
        items: contexts.map((context) => ({ context })),
      });
      toast.success({ title: BATCH_PAYOUT_TOAST.SUBMITTED });
      setPhase("done");
      onOpenChange(false);
    } catch (error) {
      setQuoteError(error instanceof Error ? error.message : "Sign failed");
      setPhase("idle");
    } finally {
      setBusy(false);
    }
  }

  const progressLabel = progress.total > 0
    ? `${Math.round((progress.done / progress.total) * 100)}%`
    : "";

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Batch payout"
      desktopClassName={BATCH_PAYOUT_DIALOG_DESKTOP_CLASSNAME}
      sheetClassName="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-t-[24px] border-none bg-[#fdfdfd] p-0 shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)]"
    >
      <div className="flex min-h-0 flex-1 flex-col bg-[#fdfdfd] md:max-h-[90vh] md:rounded-[24px] md:shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)]">
        <div className="flex shrink-0 flex-row items-center justify-between px-4 pt-4 pb-2 sm:px-5 sm:pt-5">
          <h2 className="font-montserrat text-[18px] font-semibold text-black">
            Batch payout
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="inline-flex size-8 items-center justify-center rounded-full transition-colors hover:bg-black/5"
          >
            <IconClose className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-5">
            {step === 1 ? (
              <SelectEmployeesStep
                page={page}
                onPageChange={setPage}
                selected={selected}
                onToggle={toggleEmployee}
                onTogglePage={togglePage}
              />
            ) : null}
            {step === 2 ? (
              <EditAmountsStep drafts={drafts} onChange={updateDraft} />
            ) : null}
            {step === 3 ? (
              <ReviewPayStep
                drafts={drafts}
                originToken={originToken}
                onOriginTokenChange={setOriginToken}
                boundAddress={payWallet.boundAddress}
                walletConnected={payWallet.wallet.isConnected}
                walletIcon={payWallet.walletInfo.icon}
                connecting={payWallet.bindingWallet || payWallet.pendingBind}
                onConnectWallet={payWallet.connectAndBindWallet}
                allowedBlockchains={allowedBlockchains}
                amountInDisplay={amountInDisplay}
                feeUsd={feeUsd}
                timeEstimate={timeEstimate}
                quoteError={quoteError}
              />
            ) : null}

            {busy && (phase === "dry" || phase === "live") ? (
              <p className="mt-3 font-montserrat text-[13px] text-[#606060]">
                Getting quotes… {progressLabel}
              </p>
            ) : null}
        </div>
        <div className="shrink-0 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              {step > 1 ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={goBack}
                  className="h-11 w-full rounded-[12px] px-4 font-montserrat text-[14px] text-black hover:bg-black/5 disabled:opacity-40 md:w-auto"
                >
                  Back
                </button>
              ) : (
                <span className="hidden md:block" />
              )}
              {step === 1 ? (
                <button
                  type="button"
                  disabled={selectedCount === 0}
                  onClick={goStep2}
                  className="h-11 w-full rounded-[12px] bg-black px-5 font-montserrat text-[14px] font-medium text-white disabled:opacity-40 md:ml-auto md:w-auto"
                >
                  Next
                </button>
              ) : null}
              {step === 2 ? (
                <button
                  type="button"
                  disabled={!allDraftsValid(drafts)}
                  onClick={() => setStep(3)}
                  className="h-11 w-full rounded-[12px] bg-black px-5 font-montserrat text-[14px] font-medium text-white disabled:opacity-40 md:w-auto"
                >
                  Next
                </button>
              ) : null}
              {step === 3 ? (
                <button
                  type="button"
                  disabled={busy || !originToken}
                  onClick={() => {
                    if (dryReady) void handleSign();
                    else void handleReview();
                  }}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-black px-5 font-montserrat text-[14px] font-medium text-white disabled:opacity-40 md:w-auto"
                >
                  {busy ? (
                    <span className="size-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                  ) : null}
                  {busy
                    ? phase === "signing"
                      ? "Confirm in wallet…"
                      : `Quoting ${progressLabel}`
                    : dryReady
                      ? "Sign"
                      : "Review"}
                </button>
              ) : null}
            </div>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
