import { useState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";
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
import { api } from "@/lib/api";
import { formatTokenAmount } from "@/lib/useData";

interface PayDialogProps {
  run: { id: string; label: string; itemCount: number; usdcMinor: number; usdtMinor: number };
  onClose: () => void;
}

type Step = "confirm" | "quoting" | "done" | "error";

export function PayDialog({ run, onClose }: PayDialogProps) {
  const [step, setStep] = useState<Step>("confirm");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [validation, setValidation] = useState<{ itemCount: number; validatedItemCount: number } | null>(null);

  const start = async () => {
    setStep("quoting");
    setError("");
    try {
      const result = await api.quote({ runId: run.id, dry: true });
      setValidation({ itemCount: result.itemCount, validatedItemCount: result.validatedItemCount });
      setStep("done");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Quote failed");
      setStep("error");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader className="pr-8">
          <span className="mb-1 grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            {step === "done" ? <CheckCircle2 className="size-5" /> : <ShieldCheck className="size-5" />}
          </span>
          <DialogTitle className="text-lg">{step === "done" ? "Dry-run completed" : "Validate this payroll batch?"}</DialogTitle>
          <DialogDescription className="leading-6">
            {run.label} · {run.itemCount} payments. This checks server-side readiness without contacting 1Click, signing, submitting, or moving funds.
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
          <>
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Checkbox id="dry-run-confirmation" checked={confirmed} onCheckedChange={(checked) => setConfirmed(checked === true)} />
              <Label htmlFor="dry-run-confirmation" className="items-start text-sm leading-5 font-normal">
                I reviewed the totals and want to run a non-executing payment readiness check.
              </Label>
            </div>
            <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
              <ShieldCheck />
              <AlertTitle>Safety mode is enforced</AlertTitle>
              <AlertDescription className="text-emerald-800">
                Wallet signing and live submission remain disabled by the API.
              </AlertDescription>
            </Alert>
          </>
        )}

        {step === "quoting" && (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Checking employee and payout readiness…
          </div>
        )}

        {step === "done" && validation && (
          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
            <CheckCircle2 />
            <AlertTitle>Readiness validated for {validation.validatedItemCount} of {validation.itemCount} pending payments</AlertTitle>
            <AlertDescription className="text-emerald-800">
              No intent was generated, no signature was requested, and no payment record was created.
            </AlertDescription>
          </Alert>
        )}

        {step === "error" && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Readiness check failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertCircle />
          <AlertTitle>Local preflight only</AlertTitle>
          <AlertDescription className="text-amber-800">
            Mainnet execution stays locked until production asset mappings, partner credentials, and small-amount acceptance checks are complete.
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={onClose}>{step === "done" ? "Close" : "Cancel"}</Button>
          {step === "confirm" && (
            <Button type="button" disabled={!confirmed} onClick={start}>
              <ShieldCheck data-icon="inline-start" />
              Run dry check
            </Button>
          )}
          {step === "error" && <Button type="button" onClick={start}>Retry</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
