import { useState } from "react";
import { ChevronRight, CircleDollarSign, Plus, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyPanel, PageHeader, StatusBadge, TokenCell } from "@/components/WorkspaceUI";
import { PayDialog } from "@/components/PayDialog";
import { api, type PayrollRun, type PayrunItem } from "@/lib/api";
import { formatTokenAmount, isValidTokenAmount, useApi } from "@/lib/useData";

const PAYMENT_STATE_LABELS: Record<string, string> = {
  created: "Preparing",
  quoting: "Quoting",
  quoted: "Quoted",
  generating: "Generating intent",
  awaiting_signature: "Awaiting signature",
  submitting: "Submitting",
  submitted: "Submitted",
  processing: "Processing",
  confirmed: "Paid",
  failed: "Failed",
  refunded: "Refunded",
};

function runStatusLabel(status: PayrollRun["status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function itemDisplayState(item: PayrunItem): { status: string; label: string } {
  const status = item.payment_state || item.status;
  return {
    status,
    label: status === "confirmed" || status === "paid" ? "Paid" : PAYMENT_STATE_LABELS[status] || status,
  };
}

export function PayrollPage() {
  const { data, loading, refresh } = useApi(() => api.listRuns(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [label, setLabel] = useState("");
  const [payDate, setPayDate] = useState("");
  const [showPay, setShowPay] = useState(false);

  const runs = data?.runs ?? [];
  const selected = runs.find((run) => run.id === selectedId) ?? runs[0] ?? null;

  const create = async () => {
    if (!label.trim()) return;
    const { run } = await api.createRun({
      label: label.trim(),
      payDate: payDate || new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
    });
    setLabel("");
    setPayDate("");
    setShowCreate(false);
    setSelectedId(run.id);
    await refresh();
  };

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Payroll"
        title="Payroll runs"
        description="Enter net amounts per employee, review payout status, then run a non-executing payment readiness check."
        actions={(
          <>
            <Button variant="outline" type="button" onClick={() => setShowCreate(true)}>
              <Plus data-icon="inline-start" />
              New run
            </Button>
            {selected && (
              <Button type="button" disabled={selected.itemCount === 0} onClick={() => setShowPay(true)}>
                <ShieldCheck data-icon="inline-start" />
                Dry-run check
              </Button>
            )}
          </>
        )}
      />

      <Card>
        <CardHeader>
          <CardTitle>All payroll runs</CardTitle>
          <CardDescription>Select a run to review its payment list.</CardDescription>
          <CardAction><Badge variant="secondary">{runs.length} total</Badge></CardAction>
        </CardHeader>
        <CardContent className="px-0">
          {loading ? (
            <div className="grid h-32 place-items-center text-sm text-muted-foreground">Loading payroll runs…</div>
          ) : runs.length === 0 ? (
            <div className="px-4 pb-4"><EmptyPanel title="No payroll runs yet" description="Create your first run, then add employee payments to it." /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Run</TableHead>
                  <TableHead>Pay date</TableHead>
                  <TableHead>Payments</TableHead>
                  <TableHead>USDC</TableHead>
                  <TableHead>USDT</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16 pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id} data-state={selected?.id === run.id ? "selected" : undefined}>
                    <TableCell className="pl-4">
                      <button type="button" className="font-medium hover:underline" onClick={() => setSelectedId(run.id)}>
                        {run.label}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{run.pay_date}</TableCell>
                    <TableCell>{run.itemCount}</TableCell>
                    <TableCell className="tabular-nums">{formatTokenAmount(run.usdcMinor)}</TableCell>
                    <TableCell className="tabular-nums">{formatTokenAmount(run.usdtMinor)}</TableCell>
                    <TableCell><StatusBadge status={run.status} label={runStatusLabel(run.status)} /></TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button variant="ghost" size="icon-sm" type="button" onClick={() => setSelectedId(run.id)} aria-label={`Open ${run.label}`}>
                        <ChevronRight />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selected && <RunDetail runId={selected.id} onChanged={refresh} />}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create payroll run</DialogTitle>
            <DialogDescription>Set a label and pay date. Payments can be added after creation.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="run-label">Run label</FieldLabel>
              <Input id="run-label" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="e.g. September 2026" autoFocus />
            </Field>
            <Field>
              <FieldLabel htmlFor="run-pay-date">Pay date</FieldLabel>
              <Input id="run-pay-date" type="date" value={payDate} onChange={(event) => setPayDate(event.target.value)} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="button" onClick={create} disabled={!label.trim()}>Create run</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showPay && selected && <PayDialog run={selected} onClose={() => setShowPay(false)} />}
    </div>
  );
}

function RunDetail({ runId, onChanged }: { runId: string; onChanged: () => Promise<void> }) {
  const { data, loading, refresh } = useApi(() => api.getRun(runId), [runId]);
  const [showAdd, setShowAdd] = useState(false);
  const [employeeName, setEmployeeName] = useState("");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState("USDC");
  const [network, setNetwork] = useState("Base");

  if (loading && !data) {
    return <Card><CardContent className="grid h-40 place-items-center text-sm text-muted-foreground">Loading payment list…</CardContent></Card>;
  }
  if (!data) return null;
  const { run, items } = data;

  const addItem = async () => {
    if (!employeeName.trim() || !isValidTokenAmount(amount)) return;
    await api.addItem(runId, { employeeName: employeeName.trim(), amount: amount.trim(), token, network });
    setEmployeeName("");
    setAmount("");
    setShowAdd(false);
    await Promise.all([refresh(), onChanged()]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{run.label} · payment list</CardTitle>
        <CardDescription>Net amounts are kept exactly as entered. {items.length} payments shown.</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" type="button" onClick={() => setShowAdd((current) => !current)}>
            <Plus data-icon="inline-start" />
            Add payment
          </Button>
        </CardAction>
      </CardHeader>

      {showAdd && (
        <CardContent className="border-y bg-muted/20 py-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_150px_130px_160px_auto] xl:items-end">
            <Field>
              <FieldLabel htmlFor="payment-employee">Employee name</FieldLabel>
              <Input id="payment-employee" value={employeeName} onChange={(event) => setEmployeeName(event.target.value)} placeholder="Full name" />
            </Field>
            <Field>
              <FieldLabel htmlFor="payment-amount">Net amount</FieldLabel>
              <Input id="payment-amount" type="number" min="0" step="0.000001" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.000000" />
            </Field>
            <Field>
              <FieldLabel>Token</FieldLabel>
              <Select value={token} onValueChange={setToken}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="USDC">USDC</SelectItem><SelectItem value="USDT">USDT</SelectItem></SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Network</FieldLabel>
              <Select value={network} onValueChange={setNetwork}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Base", "Arbitrum", "Polygon", "Optimism", "Ethereum"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Button type="button" onClick={addItem} disabled={!employeeName.trim() || !isValidTokenAmount(amount)}>
              <Plus data-icon="inline-start" />Add
            </Button>
          </div>
        </CardContent>
      )}

      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Employee</TableHead>
              <TableHead>Net amount</TableHead>
              <TableHead>Token & network</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-4 text-right">Intent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const displayState = itemDisplayState(item);
              return (
                <TableRow key={item.id}>
                  <TableCell className="pl-4">
                    <span className="flex items-center gap-2.5">
                      <span className="grid size-8 place-items-center rounded-full bg-muted text-xs font-medium">{item.employee_name.slice(0, 2).toUpperCase()}</span>
                      <strong className="font-medium">{item.employee_name}</strong>
                    </span>
                  </TableCell>
                  <TableCell className="font-medium tabular-nums">{formatTokenAmount(item.amount_minor)} <small className="font-normal text-muted-foreground">{item.token}</small></TableCell>
                  <TableCell><TokenCell token={item.token} network={item.network} /></TableCell>
                  <TableCell><StatusBadge status={displayState.status} label={displayState.label} /></TableCell>
                  <TableCell className="pr-4 text-right">
                    {item.intent_hash ? <span className="mono-value text-xs text-muted-foreground">{item.intent_hash.slice(0, 14)}…</span> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              );
            })}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={5} className="h-28 text-center text-muted-foreground">No payments in this run yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <div className="flex items-center gap-2 border-t bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        <CircleDollarSign className="size-3.5" />
        Token amounts support up to six decimal places.
      </div>
    </Card>
  );
}
