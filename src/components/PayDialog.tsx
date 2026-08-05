// Pay dialog: quote → generate intent → wallet signs (ERC-191) → submit → record

import { useEffect, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { AlertCircle, Check, Send, WalletCards, X } from "lucide-react";
import { api, type AuthUser } from "../lib/api";
import { encodeErc191Signature } from "../lib/erc191";
import { formatMoney } from "../lib/useData";

interface PayDialogProps {
  user: AuthUser;
  run: { id: string; label: string; itemCount: number; usdc: number; usdt: number };
  onClose: () => void;
  onPaid: () => void;
  onRequireWallet: () => void;
}

type Step = "confirm" | "quoting" | "sign" | "submitting" | "done" | "error";

export function PayDialog({ user, run, onClose, onPaid, onRequireWallet }: PayDialogProps) {
  const [step, setStep] = useState<Step>("confirm");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [quoteInfo, setQuoteInfo] = useState<{ recordId: string; quote: { depositAddress?: string; amountIn?: string; amountOut?: string } } | null>(null);
  const [intentInfo, setIntentInfo] = useState<{ payload: unknown; payloadString: string; correlationId: string } | null>(null);
  const [intentHash, setIntentHash] = useState("");

  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  useEffect(() => {
    if (!isConnected) {
      onRequireWallet();
    }
  }, [isConnected, onRequireWallet]);

  const start = async () => {
    setStep("quoting");
    setError("");
    try {
      const { quote, recordId } = await api.quote({ runId: run.id, dry: false });
      const q = quote as { depositAddress?: string; amountIn?: string; amountOut?: string };
      if (!q.depositAddress) throw new Error("No deposit address returned — payment service rejected the quote");
      setQuoteInfo({ recordId, quote: q });
      setStep("sign");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quote failed");
      setStep("error");
    }
  };

  const signAndSubmit = async () => {
    if (!quoteInfo || !address) return;
    setStep("submitting");
    setError("");
    try {
      // 1. generate unsigned intent (ERC-191 for EVM wallet)
      const gen = await api.generateIntent({
        depositAddress: quoteInfo.quote.depositAddress!,
        signerId: address,
        standard: "erc191",
      });
      const payloadString = typeof gen.intent.payload === "string"
        ? gen.intent.payload
        : JSON.stringify(gen.intent.payload);
      // 2. wallet signs the payload string (personal_sign / EIP-191)
      const sig = await signMessageAsync({ message: payloadString });
      // 3. encode signature for NEAR Intents verifier
      const encoded = encodeErc191Signature(sig);
      // 4. submit
      const res = await api.submitIntent({
        recordId: quoteInfo.recordId,
        signedData: { standard: "erc191", payload: payloadString, signature: encoded },
      });
      setIntentHash(res.intentHash);
      setStep("done");
      onPaid();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signing failed");
      setStep("error");
    }
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="pay-title">
        <header className="dialog-header"><strong>Send payroll</strong><button className="icon-button" type="button" onClick={onClose} aria-label="Close"><X size={19} /></button></header>
        <div className="dialog-body">
          <span className="dialog-symbol symbol-send"><Send size={22} /></span>
          <h2 id="pay-title">{step === "done" ? "Payment submitted" : "Send this payroll batch?"}</h2>
          <p>
            {run.label} · {run.itemCount} payments · USDC {formatMoney(run.usdc)} + USDT {formatMoney(run.usdt)}.
            The swap executes on NEAR Intents' private chain — amounts stay hidden from the public blockchain.
          </p>

          <dl className="dialog-summary"><div><dt>Payments</dt><dd>{run.itemCount}</dd></div><div><dt>USDC</dt><dd>{formatMoney(run.usdc)}</dd></div><div><dt>USDT</dt><dd>{formatMoney(run.usdt)}</dd></div></dl>

          {step === "confirm" && (
            <>
              <label className="confirmation-check"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /><span>I reviewed the totals and understand this initiates a confidential payment via my connected wallet.</span></label>
              <div className="dialog-note"><AlertCircle size={16} /><span>This opens your EVM wallet to sign a NEAR Intents payment intent. No funds leave your wallet except through the signed intent.</span></div>
            </>
          )}

          {step === "quoting" && <p className="step-status">Requesting confidential quote…</p>}
          {step === "sign" && quoteInfo && (
            <div className="dialog-note"><Check size={16} /><span>Quote received. Reviewing {quoteInfo.quote.amountOut ? `~${formatMoney(Number(quoteInfo.quote.amountOut) / 1e6)} output` : "output"} — next, your wallet will be asked to sign the intent.</span></div>
          )}
          {step === "submitting" && <p className="step-status">Waiting for wallet signature…</p>}
          {step === "done" && (
            <div className="payment-done">
              <Check size={20} /><span>Intent submitted. <span className="mono-value">{intentHash.slice(0, 18)}…</span></span>
              <small>The payment record will update as the swap confirms.</small>
            </div>
          )}
          {step === "error" && <div className="dialog-warning"><AlertCircle size={16} /><span>{error}</span></div>}

          <div className="dialog-warning" style={{ marginTop: 12 }}>
            <AlertCircle size={16} /><span>Payment status updates live. In production, employees receive their stablecoin on their chosen chain after the swap confirms.</span>
          </div>
        </div>
        <div className="dialog-actions">
          <button className="button button-secondary" type="button" onClick={onClose}>{step === "done" ? "Close" : "Cancel"}</button>
          {step === "confirm" && <button className="button button-primary" type="button" disabled={!confirmed} onClick={start}><Send size={16} />Request quote</button>}
          {step === "sign" && <button className="button button-primary" type="button" onClick={signAndSubmit}><WalletCards size={16} />Sign with wallet</button>}
          {step === "error" && <button className="button button-primary" type="button" onClick={start}>Retry</button>}
        </div>
      </section>
    </div>
  );
}
