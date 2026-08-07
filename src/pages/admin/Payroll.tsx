import { useEffect, useState } from "react";
import { Archive, CalendarClock, ChevronRight, CircleDollarSign, FileUp, Pause, Pencil, Play, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { PayrollImportDialog } from "@/components/PayrollImportDialog";
import { api, type AuthUser, type Employee, type PayrollCadence, type PayrollRun, type PayrollSchedule, type PayrunItem } from "@/lib/api";
import { inFlightSubmittedAttempts, pollSubmittedAttemptsUntilSettled } from "@/lib/payment";
import { minorAmountToCsv } from "@/lib/payroll-import";
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

const CADENCE_LABELS: Record<PayrollCadence, string> = {
  manual: "Does not repeat",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
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

function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  actionLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  actionLabel: string;
  onConfirm: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to complete this action");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error && <Alert variant="destructive"><AlertTitle>Action failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" type="button" onClick={confirm} disabled={submitting}>{submitting ? "Working…" : actionLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleEditDialog({
  schedule,
  onOpenChange,
  onSaved,
}: {
  schedule: PayrollSchedule | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(schedule?.name ?? "");
  const [cadence, setCadence] = useState<Exclude<PayrollCadence, "manual">>(schedule?.cadence ?? "monthly");
  const [nextPayDate, setNextPayDate] = useState(schedule?.next_pay_date ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!schedule) return null;
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.updatePayrollSchedule(schedule.id, { name: name.trim(), cadence, nextPayDate });
      await onSaved();
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update schedule");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit recurring payroll</DialogTitle>
          <DialogDescription>Future draft runs will use this frequency and next pay date. Existing runs are unchanged.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field><FieldLabel htmlFor="schedule-name">Schedule name</FieldLabel><Input id="schedule-name" value={name} onChange={(event) => setName(event.target.value)} autoFocus /></Field>
          <Field>
            <FieldLabel>Frequency</FieldLabel>
            <Select value={cadence} onValueChange={(value) => setCadence(value as Exclude<PayrollCadence, "manual">)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["weekly", "biweekly", "monthly"] as const).map((value) => <SelectItem key={value} value={value}>{CADENCE_LABELS[value]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field><FieldLabel htmlFor="schedule-next-date">Next pay date</FieldLabel><Input id="schedule-next-date" type="date" value={nextPayDate} onChange={(event) => setNextPayDate(event.target.value)} /></Field>
        </FieldGroup>
        {error && <Alert variant="destructive"><AlertTitle>Schedule not updated</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={save} disabled={saving || !name.trim() || !nextPayDate}>{saving ? "Saving…" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RunEditDialog({ run, onOpenChange, onSaved }: { run: PayrollRun | null; onOpenChange: (open: boolean) => void; onSaved: () => Promise<void> }) {
  const [label, setLabel] = useState(run?.label ?? "");
  const [payDate, setPayDate] = useState(run?.pay_date ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!run) return null;
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.updateRun(run.id, { label: label.trim(), payDate });
      await onSaved();
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update payroll run");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Edit payroll run</DialogTitle><DialogDescription>Only draft runs without payment attempts can be edited.</DialogDescription></DialogHeader>
        <FieldGroup>
          <Field><FieldLabel htmlFor="edit-run-label">Run label</FieldLabel><Input id="edit-run-label" value={label} onChange={(event) => setLabel(event.target.value)} autoFocus /></Field>
          <Field><FieldLabel htmlFor="edit-run-date">Pay date</FieldLabel><Input id="edit-run-date" type="date" value={payDate} onChange={(event) => setPayDate(event.target.value)} /></Field>
        </FieldGroup>
        {error && <Alert variant="destructive"><AlertTitle>Run not updated</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        <DialogFooter><Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="button" onClick={save} disabled={saving || !label.trim() || !payDate}>{saving ? "Saving…" : "Save changes"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ItemEditDialog({
  runId,
  item,
  employees,
  onOpenChange,
  onSaved,
}: {
  runId: string;
  item: PayrunItem | null;
  employees: Employee[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [recipient, setRecipient] = useState(item?.employee_id ?? "manual");
  const [employeeName, setEmployeeName] = useState(item?.employee_name ?? "");
  const [amount, setAmount] = useState(item ? minorAmountToCsv(item.amount_minor) : "");
  const [token, setToken] = useState(item?.token ?? "USDC");
  const [network, setNetwork] = useState(item?.network ?? "Base");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!item) return null;
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.updatePayrollItem(runId, item.id, recipient === "manual"
        ? { employeeId: null, employeeName: employeeName.trim(), amount: amount.trim(), token, network }
        : { employeeId: recipient, amount: amount.trim() });
      await onSaved();
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update payment");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Edit payment</DialogTitle><DialogDescription>Change the recipient and amount while this run is still a draft.</DialogDescription></DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>Recipient type</FieldLabel>
            <Select value={recipient} onValueChange={(value) => {
              setRecipient(value);
              if (value === "manual") {
                setEmployeeName(item.employee_id ? "" : item.employee_name);
                setToken(item.employee_id ? "USDC" : item.token);
                setNetwork(item.employee_id ? "Base" : item.network);
              } else {
                const employee = employees.find((candidate) => candidate.id === value);
                if (employee) { setEmployeeName(employee.name); setToken(employee.token); setNetwork(employee.network); }
              }
            }}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="manual">Manual draft recipient</SelectItem>{employees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.name}{employee.email ? ` · ${employee.email}` : ""}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field><FieldLabel htmlFor="edit-payment-recipient">{recipient === "manual" ? "Recipient name" : "Employee"}</FieldLabel><Input id="edit-payment-recipient" value={employeeName} onChange={(event) => setEmployeeName(event.target.value)} disabled={recipient !== "manual"} /></Field>
          <Field><FieldLabel htmlFor="edit-payment-amount">Net amount</FieldLabel><Input id="edit-payment-amount" type="number" min="0" step="0.000001" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field><FieldLabel>Token</FieldLabel><Select value={token} onValueChange={(value) => setToken(value as "USDC" | "USDT")}><SelectTrigger className="w-full" disabled={recipient !== "manual"}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USDC">USDC</SelectItem><SelectItem value="USDT">USDT</SelectItem></SelectContent></Select></Field>
            <Field><FieldLabel>Network</FieldLabel><Select value={network} onValueChange={setNetwork}><SelectTrigger className="w-full" disabled={recipient !== "manual"}><SelectValue /></SelectTrigger><SelectContent>{["Base", "Arbitrum", "Polygon", "Optimism", "Ethereum"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></Field>
          </div>
        </FieldGroup>
        {error && <Alert variant="destructive"><AlertTitle>Payment not updated</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        <DialogFooter><Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="button" onClick={save} disabled={saving || !employeeName.trim() || !isValidTokenAmount(amount)}>{saving ? "Saving…" : "Save changes"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PayrollPage({ user }: { user: AuthUser }) {
  const { data, loading, refresh } = useApi(() => api.listRuns(), []);
  const { data: employeeData } = useApi(() => api.listEmployees(), []);
  const { data: scheduleData, refresh: refreshSchedules } = useApi(() => api.listPayrollSchedules(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [label, setLabel] = useState("");
  const [payDate, setPayDate] = useState("");
  const [cadence, setCadence] = useState<PayrollCadence>("manual");
  const [showPay, setShowPay] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<PayrollSchedule | null>(null);
  const [archivingSchedule, setArchivingSchedule] = useState<PayrollSchedule | null>(null);
  const [scheduleActionError, setScheduleActionError] = useState<string | null>(null);

  const runs = data?.runs ?? [];
  const employees = employeeData?.employees ?? [];
  const schedules = scheduleData?.schedules ?? [];
  const selected = runs.find((run) => run.id === selectedId) ?? runs[0] ?? null;

  const openRun = (run: PayrollRun) => {
    setSelectedId(run.id);
    if (run.itemCount > 0 && run.status !== "paid") setShowPay(true);
  };

  const create = async () => {
    if (!label.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const { run } = await api.createRun({
        label: label.trim(),
        payDate: payDate || new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
        cadence,
      });
      setLabel("");
      setPayDate("");
      setCadence("manual");
      setShowCreate(false);
      setSelectedId(run.id);
      await Promise.all([refresh(), refreshSchedules()]);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Unable to create payroll run");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Payroll"
        title="Payroll runs"
        description="Enter net amounts per employee, validate payout readiness, then send confidential mainnet payments when the API is unlocked."
        actions={(
          <Button variant="outline" type="button" onClick={() => setShowCreate(true)}>
            <Plus data-icon="inline-start" />
            New run
          </Button>
        )}
      />

      {schedules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recurring payroll</CardTitle>
            <CardDescription>Schedules create draft runs five days before each pay date. They never approve or send payments automatically.</CardDescription>
            <CardAction><Badge variant="secondary">{schedules.filter((schedule) => schedule.active).length} active</Badge></CardAction>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {schedules.map((schedule) => (
              <div key={schedule.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{schedule.name}</span>
                    <Badge variant={schedule.active ? "secondary" : "outline"}>{schedule.active ? "Active" : "Paused"}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{CADENCE_LABELS[schedule.cadence]} · next pay date {schedule.next_pay_date}</p>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  <Button variant="outline" size="sm" type="button" onClick={() => setEditingSchedule(schedule)} aria-label={`Edit ${schedule.name}`}>
                    <Pencil data-icon="inline-start" />Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={async () => {
                      setScheduleActionError(null);
                      try {
                        await api.updatePayrollSchedule(schedule.id, { active: !schedule.active });
                        await refreshSchedules();
                      } catch (error) {
                        setScheduleActionError(error instanceof Error ? error.message : "Unable to update schedule");
                      }
                    }}
                    aria-label={`${schedule.active ? "Pause" : "Resume"} ${schedule.name}`}
                  >
                    {schedule.active ? <Pause data-icon="inline-start" /> : <Play data-icon="inline-start" />}
                    {schedule.active ? "Pause" : "Resume"}
                  </Button>
                  <Button variant="ghost" size="icon-sm" type="button" onClick={() => setArchivingSchedule(schedule)} aria-label={`Archive ${schedule.name}`}>
                    <Archive />
                  </Button>
                </div>
              </div>
            ))}
            {scheduleActionError && <Alert className="md:col-span-2" variant="destructive"><AlertTitle>Schedule not updated</AlertTitle><AlertDescription>{scheduleActionError}</AlertDescription></Alert>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All payroll runs</CardTitle>
          <CardDescription>Select any run row to review and pay. Empty or already-paid runs open their details instead.</CardDescription>
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
                  <TableHead>Frequency</TableHead>
                  <TableHead>Payments</TableHead>
                  <TableHead>USDC</TableHead>
                  <TableHead>USDT</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16 pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow
                    key={run.id}
                    data-state={selected?.id === run.id ? "selected" : undefined}
                    className="cursor-pointer transition-colors hover:bg-muted/50 focus-within:bg-muted/50"
                    onClick={() => openRun(run)}
                  >
                    <TableCell className="pl-4">
                      <button
                        type="button"
                        className="font-medium text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        aria-label={`${run.itemCount > 0 && run.status !== "paid" ? "Review and pay" : "Open"} ${run.label}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          openRun(run);
                        }}
                      >
                        {run.label}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{run.pay_date}</TableCell>
                    <TableCell><Badge variant="outline">{CADENCE_LABELS[run.cadence]}</Badge></TableCell>
                    <TableCell>{run.itemCount}</TableCell>
                    <TableCell className="tabular-nums">{formatTokenAmount(run.usdcMinor)}</TableCell>
                    <TableCell className="tabular-nums">{formatTokenAmount(run.usdtMinor)}</TableCell>
                    <TableCell><StatusBadge status={run.status} label={runStatusLabel(run.status)} /></TableCell>
                    <TableCell className="pr-4 text-right">
                      <ChevronRight className="ml-auto size-4 text-muted-foreground" aria-hidden="true" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selected && (
        <RunDetail
          runId={selected.id}
          employees={employees}
          onChanged={refresh}
          onArchived={async () => {
            setSelectedId(null);
            await refresh();
          }}
        />
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create payroll run</DialogTitle>
            <DialogDescription>Set the first pay date and choose whether SalaryFlow should prepare future draft runs.</DialogDescription>
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
            <Field>
              <FieldLabel>Frequency</FieldLabel>
              <Select value={cadence} onValueChange={(value) => setCadence(value as PayrollCadence)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(CADENCE_LABELS) as Array<[PayrollCadence, string]>).map(([value, text]) => <SelectItem key={value} value={value}>{text}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          {cadence !== "manual" && (
            <Alert>
              <CalendarClock />
              <AlertTitle>Drafts only</AlertTitle>
              <AlertDescription>A new draft will be prepared five days before each pay date using the latest run's payment list. Review is always required before payment.</AlertDescription>
            </Alert>
          )}
          {createError && <Alert variant="destructive"><AlertTitle>Run not created</AlertTitle><AlertDescription>{createError}</AlertDescription></Alert>}
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="button" onClick={create} disabled={creating || !label.trim()}>{creating ? "Creating…" : cadence === "manual" ? "Create run" : "Create schedule"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showPay && selected && (
        <PayDialog
          run={selected}
          user={user}
          onClose={() => setShowPay(false)}
          onCompleted={() => { void refresh(); }}
        />
      )}
      <ScheduleEditDialog key={editingSchedule?.id ?? "closed-schedule"} schedule={editingSchedule} onOpenChange={(open) => { if (!open) setEditingSchedule(null); }} onSaved={refreshSchedules} />
      <ConfirmActionDialog
        open={!!archivingSchedule}
        onOpenChange={(open) => { if (!open) setArchivingSchedule(null); }}
        title="Archive recurring payroll?"
        description="SalaryFlow will stop creating future drafts. Existing payroll runs and audit history will be retained."
        actionLabel="Archive schedule"
        onConfirm={async () => {
          if (!archivingSchedule) return;
          await api.archivePayrollSchedule(archivingSchedule.id);
          await refreshSchedules();
        }}
      />
    </div>
  );
}

function RunDetail({ runId, employees, onChanged, onArchived }: { runId: string; employees: Employee[]; onChanged: () => Promise<void>; onArchived: () => Promise<void> }) {
  const { data, loading, refresh } = useApi(() => api.getRun(runId), [runId]);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [recipient, setRecipient] = useState("manual");
  const [employeeName, setEmployeeName] = useState("");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState("USDC");
  const [network, setNetwork] = useState("Base");
  const [addError, setAddError] = useState<string | null>(null);
  const [editingRun, setEditingRun] = useState<PayrollRun | null>(null);
  const [archivingRun, setArchivingRun] = useState(false);
  const [editingItem, setEditingItem] = useState<PayrunItem | null>(null);
  const [removingItem, setRemovingItem] = useState<PayrunItem | null>(null);
  const [refreshingSettlement, setRefreshingSettlement] = useState(false);
  const [settlementError, setSettlementError] = useState<string | null>(null);

  const refreshSettlement = async () => {
    setRefreshingSettlement(true);
    setSettlementError(null);
    try {
      const { attempts } = await api.listPaymentAttempts(runId);
      const open = inFlightSubmittedAttempts(attempts);
      if (open.length === 0) {
        await Promise.all([refresh(), onChanged()]);
        return;
      }
      await pollSubmittedAttemptsUntilSettled({
        attemptIds: open.map((attempt) => attempt.id),
        rounds: 8,
      });
      await Promise.all([refresh(), onChanged()]);
    } catch (error) {
      setSettlementError(error instanceof Error ? error.message : "Unable to refresh settlement");
    } finally {
      setRefreshingSettlement(false);
    }
  };

  // Local wrangler cron does not reliably settle payments; auto-poll when opening a processing run.
  useEffect(() => {
    if (!data) return;
    const processing = data.items.some((item) => item.status === "processing" || item.payment_state === "processing" || item.payment_state === "submitted");
    if (!processing) return;
    void refreshSettlement();
    // Only when switching to this run / first load with processing rows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, data?.run.status]);

  if (loading && !data) {
    return <Card><CardContent className="grid h-40 place-items-center text-sm text-muted-foreground">Loading payment list…</CardContent></Card>;
  }
  if (!data) return null;
  const { run, items } = data;
  const hasInFlight = items.some((item) => (
    item.status === "processing"
    || item.payment_state === "processing"
    || item.payment_state === "submitted"
    || item.payment_state === "submitting"
  ));

  const addItem = async () => {
    if (!employeeName.trim() || !isValidTokenAmount(amount)) return;
    setAddError(null);
    try {
      await api.addItem(runId, recipient === "manual"
        ? { employeeName: employeeName.trim(), amount: amount.trim(), token, network }
        : { employeeId: recipient, amount: amount.trim() });
      setEmployeeName("");
      setAmount("");
      setRecipient("manual");
      setShowAdd(false);
      await Promise.all([refresh(), onChanged()]);
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "Unable to add payment");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{run.label} · payment list</CardTitle>
        <CardDescription>Net amounts are kept exactly as entered. {items.length} payments shown.{run.status !== "draft" ? " Editing is locked after the draft stage." : ""}</CardDescription>
        <CardAction>
          <div className="flex flex-wrap justify-end gap-2">
            {hasInFlight && (
              <Button variant="outline" size="sm" type="button" onClick={() => void refreshSettlement()} disabled={refreshingSettlement}>
                <RefreshCw data-icon="inline-start" className={refreshingSettlement ? "animate-spin" : undefined} />
                {refreshingSettlement ? "Refreshing…" : "Refresh settlement"}
              </Button>
            )}
            {run.status === "draft" && <Button variant="outline" size="sm" type="button" onClick={() => setEditingRun(run)}><Pencil data-icon="inline-start" />Edit run</Button>}
            {run.status === "draft" && <Button variant="outline" size="sm" type="button" onClick={() => setShowImport(true)}>
              <FileUp data-icon="inline-start" />Import CSV
            </Button>}
            {run.status === "draft" && <Button variant="outline" size="sm" type="button" onClick={() => setShowAdd((current) => !current)}>
              <Plus data-icon="inline-start" />Add payment
            </Button>}
            {run.status === "draft" && <Button variant="ghost" size="icon-sm" type="button" onClick={() => setArchivingRun(true)} aria-label={`Archive ${run.label}`}><Archive /></Button>}
          </div>
        </CardAction>
      </CardHeader>

      {settlementError && (
        <CardContent className="pb-0">
          <Alert variant="destructive">
            <AlertTitle>Settlement refresh failed</AlertTitle>
            <AlertDescription>{settlementError}</AlertDescription>
          </Alert>
        </CardContent>
      )}

      {showAdd && (
        <CardContent className="border-y bg-muted/20 py-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(210px,1fr)_minmax(180px,1fr)_150px_130px_160px_auto] xl:items-end">
            <Field>
              <FieldLabel>Recipient type</FieldLabel>
              <Select value={recipient} onValueChange={(value) => {
                setRecipient(value);
                if (value === "manual") {
                  setEmployeeName(""); setAmount(""); setToken("USDC"); setNetwork("Base");
                } else {
                  const employee = employees.find((candidate) => candidate.id === value);
                  if (employee) {
                    setEmployeeName(employee.name);
                    setAmount(minorAmountToCsv(employee.amount_minor));
                    setToken(employee.token);
                    setNetwork(employee.network);
                  }
                }
              }}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual draft recipient</SelectItem>
                  {employees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.name}{employee.email ? ` · ${employee.email}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="payment-employee">{recipient === "manual" ? "Recipient name" : "Employee"}</FieldLabel>
              <Input id="payment-employee" value={employeeName} onChange={(event) => setEmployeeName(event.target.value)} placeholder="Full name" disabled={recipient !== "manual"} />
            </Field>
            <Field>
              <FieldLabel htmlFor="payment-amount">Net amount</FieldLabel>
              <Input id="payment-amount" type="number" min="0" step="0.000001" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.000000" />
            </Field>
            <Field>
              <FieldLabel>Token</FieldLabel>
              <Select value={token} onValueChange={setToken}>
                <SelectTrigger className="w-full" disabled={recipient !== "manual"}><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="USDC">USDC</SelectItem><SelectItem value="USDT">USDT</SelectItem></SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Network</FieldLabel>
              <Select value={network} onValueChange={setNetwork}>
                <SelectTrigger className="w-full" disabled={recipient !== "manual"}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Base", "Arbitrum", "Polygon", "Optimism", "Ethereum"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Button type="button" onClick={addItem} disabled={!employeeName.trim() || !isValidTokenAmount(amount)}>
              <Plus data-icon="inline-start" />Add
            </Button>
          </div>
          {recipient === "manual" && <p className="mt-3 text-xs text-muted-foreground">Manual recipients are saved for planning only and cannot pass payment readiness until linked to an employee.</p>}
          {addError && <Alert className="mt-3" variant="destructive"><AlertTitle>Payment not added</AlertTitle><AlertDescription>{addError}</AlertDescription></Alert>}
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
              <TableHead className="text-right">Intent</TableHead>
              <TableHead className="w-24 pr-4 text-right">Actions</TableHead>
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
                    <div className="mt-1 pl-10">{item.employee_id ? <Badge variant="secondary">Linked employee</Badge> : <><Badge variant="outline">Manual draft</Badge><span className="ml-2 text-xs text-muted-foreground">Not payable</span></>}</div>
                  </TableCell>
                  <TableCell className="font-medium tabular-nums">{formatTokenAmount(item.amount_minor)} <small className="font-normal text-muted-foreground">{item.token}</small></TableCell>
                  <TableCell><TokenCell token={item.token} network={item.network} /></TableCell>
                  <TableCell><StatusBadge status={displayState.status} label={displayState.label} /></TableCell>
                  <TableCell className="text-right">
                    {item.intent_hash ? <span className="mono-value text-xs text-muted-foreground">{item.intent_hash.slice(0, 14)}…</span> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    {run.status === "draft" && item.status === "pending" && !item.payment_attempt_id ? (
                      <span className="inline-flex gap-1">
                        <Button variant="ghost" size="icon-sm" type="button" onClick={() => setEditingItem(item)} aria-label={`Edit payment for ${item.employee_name}`}><Pencil /></Button>
                        <Button variant="ghost" size="icon-sm" type="button" onClick={() => setRemovingItem(item)} aria-label={`Remove payment for ${item.employee_name}`}><Trash2 /></Button>
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              );
            })}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">No payments in this run yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <div className="flex items-center gap-2 border-t bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        <CircleDollarSign className="size-3.5" />
        Token amounts support up to six decimal places.
      </div>
      <PayrollImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        runId={runId}
        employees={employees}
        onImported={async () => { await Promise.all([refresh(), onChanged()]); }}
      />
      <RunEditDialog key={editingRun?.id ?? "closed-run"} run={editingRun} onOpenChange={(open) => { if (!open) setEditingRun(null); }} onSaved={async () => { await Promise.all([refresh(), onChanged()]); }} />
      <ItemEditDialog key={editingItem?.id ?? "closed-item"} runId={runId} item={editingItem} employees={employees} onOpenChange={(open) => { if (!open) setEditingItem(null); }} onSaved={async () => { await Promise.all([refresh(), onChanged()]); }} />
      <ConfirmActionDialog
        open={!!removingItem}
        onOpenChange={(open) => { if (!open) setRemovingItem(null); }}
        title="Remove this payment?"
        description={`The payment for ${removingItem?.employee_name ?? "this recipient"} will be removed from this draft. Its audit history will be retained.`}
        actionLabel="Remove payment"
        onConfirm={async () => {
          if (!removingItem) return;
          await api.removePayrollItem(runId, removingItem.id);
          await Promise.all([refresh(), onChanged()]);
        }}
      />
      <ConfirmActionDialog
        open={archivingRun}
        onOpenChange={setArchivingRun}
        title="Archive this payroll run?"
        description="The draft will leave the active payroll list. Its audit history will be retained."
        actionLabel="Archive run"
        onConfirm={async () => { await api.archiveRun(runId); await onArchived(); }}
      />
    </Card>
  );
}
