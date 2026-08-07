import { useMemo, useState } from "react";
import { useAccount, useConnect, useSignMessage } from "wagmi";
import { AlertCircle, CheckCircle2, LoaderCircle, ShieldCheck, WalletCards } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  PAYMENT_ITEM_PROGRESS_LABELS,
  type PaymentItemProgressStatus,
} from "@/components/config";
import { api, ApiError, type AuthUser, type PayrunItem } from "@/lib/api";
import {
  buildPayableWorkItems,
  executeLivePaymentItem,
  inFlightSubmittedAttempts,
  pollSubmittedAttemptsUntilSettled,
  reopenStuckPaymentAttempts,
} from "@/lib/payment";
import { formatTokenAmount } from "@/lib/useData";

interface PayDialogProps {
  run: { id: string; label: string; itemCount: number; usdcMinor: number; usdtMinor: number };
  user: AuthUser;
  onClose: () => void;
  onCompleted?: () => void;
}

type Step = "confirm" | "working" | "done" | "error";

interface ItemProgress {
  itemId: string;
  employeeName: string;
  status: PaymentItemProgressStatus;
  detail?: string;
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function PayDialog({ run, user, onClose, onCompleted }: PayDialogProps) {
  const [step, setStep] = useState<Step>("confirm");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [statusText, setStatusText] = useState("");
  const [itemProgress, setItemProgress] = useState<ItemProgress[]>([]);
  const [liveSummary, setLiveSummary] = useState<{ submitted: number; failed: number } | null>(null);

  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: connecting } = useConnect();
  const { signMessageAsync } = useSignMessage();

  const walletReady = Boolean(user.wallet_address && user.wallet_verified);
  const connectedMatches = Boolean(
    address
    && user.wallet_address
    && address.toLowerCase() === user.wallet_address.toLowerCase(),
  );
  const canStartLive = walletReady && connectedMatches && confirmed;

  const injectedConnector = useMemo(
    () => connectors.find((connector) => connector.type === "injected") ?? connectors[0],
    [connectors],
  );

  const updateItem = (itemId: string, patch: Partial<ItemProgress>) => {
    setItemProgress((current) => current.map((row) => (row.itemId === itemId ? { ...row, ...patch } : row)));
  };

  const runLivePayments = async () => {
    if (!canStartLive || !user.wallet_address) return;
    setStep("working");
    setError("");
    setLiveSummary(null);
    setStatusText("Loading payable items…");
    try {
      let [detail, attemptList] = await Promise.all([
        api.getRun(run.id),
        api.listPaymentAttempts(run.id),
      ]);

      // Failed payroll rows can be reopened for a fresh quote.
      if (detail.items.some((item) => item.status === "failed")) {
        setStatusText("Reopening failed payments…");
        await api.reopenFailedPayments(run.id);
        [detail, attemptList] = await Promise.all([
          api.getRun(run.id),
          api.listPaymentAttempts(run.id),
        ]);
      }

      // Stuck Processing rows (expired quote / never-accepted intent) block new quotes.
      // Reconcile them first so the payroll item returns to pending.
      const reopened = await reopenStuckPaymentAttempts(attemptList.attempts);
      if (reopened > 0) {
        setStatusText(`Reopened ${reopened} stuck payment${reopened === 1 ? "" : "s"}…`);
        [detail, attemptList] = await Promise.all([
          api.getRun(run.id),
          api.listPaymentAttempts(run.id),
        ]);
      }

      let workItems = buildPayableWorkItems(detail.items as PayrunItem[], attemptList.attempts);
      if (workItems.length === 0) {
        const inFlight = inFlightSubmittedAttempts(attemptList.attempts);
        if (inFlight.length > 0) {
          setStatusText("Payment already submitted — polling 1Click settlement…");
          await pollSubmittedAttemptsUntilSettled({
            attemptIds: inFlight.map((attempt) => attempt.id),
            onRound: (round) => {
              setStatusText(`Polling settlement status (check ${round + 1})…`);
            },
          });
          [detail, attemptList] = await Promise.all([
            api.getRun(run.id),
            api.listPaymentAttempts(run.id),
          ]);
          workItems = buildPayableWorkItems(detail.items as PayrunItem[], attemptList.attempts);
          const remaining = inFlightSubmittedAttempts(attemptList.attempts);
          if (workItems.length === 0 && remaining.length > 0) {
            const sample = remaining[0];
            throw new ApiError(
              `Payment is already submitted (intent ${sample.intent_hash}). Provider status is still ${sample.provider_status || sample.state}. Open the run and use Refresh settlement, or wait for the next poll — do not create another quote.`,
              409,
            );
          }
          if (workItems.length === 0) {
            const paid = detail.items.some((item) => item.status === "paid");
            const failedCount = detail.items.filter((item) => item.status === "failed").length;
            setLiveSummary({ submitted: paid ? detail.items.filter((item) => item.status === "paid").length : 0, failed: failedCount });
            setStep("done");
            setStatusText(paid ? "Payment confirmed" : "No further payments to send");
            onCompleted?.();
            return;
          }
        } else {
          throw new ApiError("No pending or resumable payments in this run", 400);
        }
      }

      // Dry-run only applies to brand-new pending rows. Quoted / awaiting_signature
      // items are already processing and would make the readiness endpoint return empty.
      const needsFreshQuote = workItems.some((item) => !item.attemptId);
      if (needsFreshQuote) {
        setStatusText("Validating payroll readiness…");
        await api.quote({ runId: run.id, dry: true });
      }

      setItemProgress(workItems.map((item) => ({
        itemId: item.itemId,
        employeeName: item.employeeName,
        status: "queued",
        detail: item.attemptId ? "Resume awaiting signature" : undefined,
      })));

      let submitted = 0;
      let failed = 0;
      for (const item of workItems) {
        try {
          const attempt = await executeLivePaymentItem({
            runId: run.id,
            itemId: item.itemId,
            attemptId: item.attemptId,
            signMessage: (message) => signMessageAsync({ message }),
            onPhase: (phase) => {
              if (phase === "quoting") {
                updateItem(item.itemId, { status: "quoting", detail: undefined });
                setStatusText(`Quoting confidential payment for ${item.employeeName}…`);
              } else if (phase === "signing") {
                updateItem(item.itemId, { status: "signing", detail: undefined });
                setStatusText(`Sign the intent for ${item.employeeName} in your wallet…`);
              } else if (phase === "settling") {
                updateItem(item.itemId, { status: "settling", detail: "Waiting for 1Click SUCCESS" });
                setStatusText(`Waiting for settlement for ${item.employeeName}…`);
              } else {
                updateItem(item.itemId, { status: "submitting", detail: undefined });
                setStatusText(`Submitting payment for ${item.employeeName}…`);
              }
            },
          });
          if (attempt.state === "confirmed") {
            updateItem(item.itemId, { status: "confirmed", detail: "Paid on destination chain" });
          } else if (attempt.state === "failed" || attempt.state === "refunded") {
            updateItem(item.itemId, {
              status: "failed",
              detail: attempt.last_error || attempt.provider_status || attempt.state,
            });
            failed += 1;
            setLiveSummary({ submitted, failed });
            setError(attempt.last_error || `Payment ${attempt.state}`);
            setStep("error");
            onCompleted?.();
            return;
          } else {
            updateItem(item.itemId, {
              status: "submitted",
              detail: `Still ${attempt.provider_status || attempt.state} — use Refresh settlement if needed`,
            });
          }
          submitted += 1;
        } catch (cause) {
          failed += 1;
          updateItem(item.itemId, {
            status: "failed",
            detail: cause instanceof Error ? cause.message : "Payment failed",
          });
          setStatusText(`Stopped after failure on ${item.employeeName}`);
          setLiveSummary({ submitted, failed });
          setError(cause instanceof Error ? cause.message : "Live payment failed");
          setStep("error");
          onCompleted?.();
          return;
        }
      }

      setLiveSummary({ submitted, failed });
      setStatusText(failed > 0 ? "Finished with failures" : "Confidential payments settled");
      setStep("done");
      onCompleted?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Live payment failed");
      setStep("error");
    }
  };

  const title = step === "done" ? "Payments submitted" : "Send confidential payroll?";

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader className="pr-8">
          <span className="mb-1 grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            {step === "done" ? <CheckCircle2 className="size-5" /> : <ShieldCheck className="size-5" />}
          </span>
          <DialogTitle className="text-lg">{title}</DialogTitle>
          <DialogDescription className="leading-6">
            {run.label} · {run.itemCount} payments.
            Live payment requests a confidential 1Click quote per employee, then asks your verified admin wallet to sign each intent.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-3 divide-x rounded-lg border bg-muted/20">
          <div className="p-3">
            <dt className="text-xs text-muted-foreground">Payments</dt>
            <dd className="mt-1 font-heading text-lg font-semibold tabular-nums">{run.itemCount}</dd>
          </div>
          <div className="p-3">
            <dt className="text-xs text-muted-foreground">USDC</dt>
            <dd className="mt-1 font-heading text-lg font-semibold tabular-nums">{formatTokenAmount(run.usdcMinor)}</dd>
          </div>
          <div className="p-3">
            <dt className="text-xs text-muted-foreground">USDT</dt>
            <dd className="mt-1 font-heading text-lg font-semibold tabular-nums">{formatTokenAmount(run.usdtMinor)}</dd>
          </div>
        </dl>

        {step === "confirm" && (
          <div className="space-y-3">
            <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <WalletCards className="size-4" />
                  </span>
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">Payment authorization wallet</p>
                    {walletReady ? (
                      <p className="mt-1 text-muted-foreground">
                        Verified {shortAddress(user.wallet_address!)}.
                        {connectedMatches
                          ? " Connected wallet matches."
                          : isConnected
                            ? ` Connected ${shortAddress(address!)} does not match. Switch wallet.`
                            : " Connect the same wallet to sign intents."}
                      </p>
                    ) : (
                      <p className="mt-1 text-muted-foreground">
                        Verify your payment wallet in Settings before sending live payroll.
                      </p>
                    )}
                  </div>
                </div>
                {walletReady && !connectedMatches && injectedConnector && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={connecting}
                    onClick={() => connect({ connector: injectedConnector })}
                  >
                    <WalletCards data-icon="inline-start" />
                    {connecting ? "Connecting…" : "Connect wallet"}
                  </Button>
                )}
            </div>

            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Checkbox
                id="payment-confirmation"
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(checked === true)}
              />
              <Label htmlFor="payment-confirmation" className="items-start text-sm leading-5 font-normal">
                I reviewed the totals and authorize confidential mainnet payment intents for this batch.
              </Label>
            </div>

            <Alert className="border-amber-200 bg-amber-50 text-amber-900">
              <AlertCircle />
              <AlertTitle>Mainnet funds can move</AlertTitle>
              <AlertDescription className="text-amber-800">
                Each payment uses NEAR Intents confidential swaps (`CONFIDENTIAL_INTENTS`). There is no testnet. Use a tiny amount first.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {step === "working" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              {statusText || "Working…"}
            </div>
            {itemProgress.length > 0 && (
              <ul className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-3 text-sm">
                {itemProgress.map((row) => (
                  <li key={row.itemId} className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="font-medium">{row.employeeName}</span>
                      {row.detail && <span className="mt-0.5 block text-xs text-muted-foreground">{row.detail}</span>}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {PAYMENT_ITEM_PROGRESS_LABELS[row.status]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {step === "done" && (
          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
            <CheckCircle2 />
            <AlertTitle>
              Submitted {liveSummary?.submitted ?? 0} confidential payment{(liveSummary?.submitted ?? 0) === 1 ? "" : "s"}
            </AlertTitle>
            <AlertDescription className="text-emerald-800">
              Settlement continues via 1Click status polling. Check Payment records for provider state updates.
            </AlertDescription>
          </Alert>
        )}

        {step === "error" && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Live payment failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {itemProgress.length > 0 && step !== "working" && (
          <ul className="max-h-40 space-y-2 overflow-y-auto rounded-lg border p-3 text-sm">
            {itemProgress.map((row) => (
              <li key={row.itemId} className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="font-medium">{row.employeeName}</span>
                  {row.detail && <span className="mt-0.5 block text-xs text-muted-foreground">{row.detail}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {PAYMENT_ITEM_PROGRESS_LABELS[row.status]}
                </span>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button variant="outline" type="button" onClick={onClose}>
            {step === "done" || step === "error" ? "Close" : "Cancel"}
          </Button>
          {step === "confirm" && (
            <Button
              type="button"
              disabled={!canStartLive}
              onClick={() => void runLivePayments()}
            >
              <ShieldCheck data-icon="inline-start" />
              Send confidential payments
            </Button>
          )}
          {step === "error" && (
            <Button type="button" onClick={() => void runLivePayments()}>
              Retry
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
