import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  EyeOff,
  Link2,
  MailPlus,
  Plus,
  RotateCw,
  Send,
  Trash2,
  UsersRound,
} from "lucide-react";
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
import { Field, FieldLabel } from "@/components/ui/field";
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
import { MetricCard, PageHeader, StatusBadge, TokenCell } from "@/components/WorkspaceUI";
import { api, type Employee, type Invitation } from "@/lib/api";
import { formatTokenAmount, initials, useApi } from "@/lib/useData";

export function TeamPayoutsPage({ onNavigate }: { onNavigate: (screen: string) => void }) {
  const { data, loading, refresh } = useApi(() => api.listEmployees(), []);
  const { data: invites, refresh: refreshInvites } = useApi(() => api.listInvites(), []);
  const employees = data?.employees ?? [];
  const attention = employees.filter((employee) => employee.status !== "ready");
  const readyCount = employees.filter((employee) => employee.status === "ready").length;

  const refreshAll = () => {
    void Promise.all([refresh(), refreshInvites()]);
  };

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Team payouts"
        title="Employees and payout methods"
        description="Employees choose their stablecoin and network. Check ownership and payout readiness before payroll preflight."
        actions={(
          <Button type="button" onClick={() => onNavigate("payroll")}>
            <Send data-icon="inline-start" />
            Review payroll
          </Button>
        )}
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MetricCard label="Team members" value={employees.length} helper="Employees on file" icon={<UsersRound />} loading={loading} />
        <MetricCard label="Ready to pay" value={readyCount} helper="Verified payout methods" icon={<CheckCircle2 />} loading={loading} />
        <MetricCard label="Need attention" value={attention.length} helper="Verification or address updates" icon={<AlertCircle />} loading={loading} />
        <MetricCard label="Data separation" value="Enabled" helper="Employees see only their own details" icon={<EyeOff />} loading={loading} />
      </section>

      {attention.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
              <AlertCircle className="size-4" />
              Review before payment
            </CardTitle>
            <CardDescription className="text-amber-800/80 dark:text-amber-300/80">
              {attention.length} {attention.length === 1 ? "employee needs" : "employees need"} an update before the batch is ready.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {attention.map((employee) => (
              <div key={employee.id} className="flex items-center gap-3 rounded-lg border border-amber-200 bg-background p-3 dark:border-amber-900">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-100 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  {initials(employee.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm font-medium">{employee.name}</strong>
                  <small className="block truncate text-xs text-muted-foreground">{employee.role_title || employee.location || employee.network}</small>
                </span>
                <StatusBadge status={employee.status} label={employee.status === "pending" ? "Pending" : "Update"} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <EmployeeTable employees={employees} onChanged={() => { void refresh(); }} />
      <InviteManager pendingInvites={invites?.invitations ?? []} onChanged={refreshAll} />

      <Alert>
        <EyeOff />
        <AlertTitle>Private employee records</AlertTitle>
        <AlertDescription>
          Invitations are delivered by email. Wallet addresses are masked in the interface; full addresses stay in the secure employee record.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function EmployeeTable({ employees, onChanged }: { employees: Employee[]; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [location, setLocation] = useState("");
  const [token, setToken] = useState<"USDC" | "USDT">("USDC");
  const [network, setNetwork] = useState("Base");

  const add = async () => {
    if (!name.trim() || !email.trim()) return;
    await api.createEmployee({
      name: name.trim(),
      email: email.trim(),
      role_title: roleTitle.trim(),
      location: location.trim(),
      token,
      network,
    });
    setName("");
    setEmail("");
    setRoleTitle("");
    setLocation("");
    setAdding(false);
    onChanged();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team directory</CardTitle>
        <CardDescription>{employees.length} employees on file.</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" type="button" onClick={() => setAdding((current) => !current)}>
            <Plus data-icon="inline-start" />
            Add employee
          </Button>
        </CardAction>
      </CardHeader>

      {adding && (
        <CardContent className="border-y bg-muted/20 py-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1.2fr_1fr_1fr_120px_150px_auto] xl:items-end">
            <Field><FieldLabel htmlFor="employee-name">Full name</FieldLabel><Input id="employee-name" value={name} onChange={(event) => setName(event.target.value)} /></Field>
            <Field><FieldLabel htmlFor="employee-email">Email</FieldLabel><Input id="employee-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
            <Field><FieldLabel htmlFor="employee-role">Role</FieldLabel><Input id="employee-role" value={roleTitle} onChange={(event) => setRoleTitle(event.target.value)} /></Field>
            <Field><FieldLabel htmlFor="employee-location">Location</FieldLabel><Input id="employee-location" value={location} onChange={(event) => setLocation(event.target.value)} /></Field>
            <Field>
              <FieldLabel>Token</FieldLabel>
              <Select value={token} onValueChange={(value) => setToken(value as "USDC" | "USDT")}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="USDC">USDC</SelectItem><SelectItem value="USDT">USDT</SelectItem></SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Network</FieldLabel>
              <Select value={network} onValueChange={setNetwork}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{["Base", "Arbitrum", "Polygon", "Optimism"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Button type="button" onClick={add} disabled={!name.trim() || !email.trim()}><Plus data-icon="inline-start" />Add</Button>
          </div>
        </CardContent>
      )}

      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Employee</TableHead>
              <TableHead>Payout method</TableHead>
              <TableHead>Wallet</TableHead>
              <TableHead>Net amount</TableHead>
              <TableHead className="pr-4">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell className="pl-4">
                  <span className="flex items-center gap-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium">{initials(employee.name)}</span>
                    <span className="min-w-0">
                      <strong className="block font-medium">{employee.name}</strong>
                      <small className="block max-w-56 truncate text-xs text-muted-foreground">{employee.email || "No email"} · {employee.role_title || employee.location || "—"}</small>
                    </span>
                  </span>
                </TableCell>
                <TableCell><TokenCell token={employee.token} network={employee.network} /></TableCell>
                <TableCell><span className="mono-value text-xs text-muted-foreground">{employee.endpoint ? `${employee.endpoint.slice(0, 6)}…${employee.endpoint.slice(-4)}` : "—"}</span></TableCell>
                <TableCell className="font-medium tabular-nums">{formatTokenAmount(employee.amount_minor)}</TableCell>
                <TableCell className="pr-4"><StatusBadge status={employee.status} /></TableCell>
              </TableRow>
            ))}
            {employees.length === 0 && (
              <TableRow><TableCell colSpan={5} className="h-28 text-center text-muted-foreground">No employees yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function InviteManager({ pendingInvites, onChanged }: { pendingInvites: Invitation[]; onChanged: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"employee" | "admin">("employee");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);

  const send = async () => {
    setNotice("");
    setError("");
    setSending(true);
    try {
      const trimmed = email.trim();
      const result = await api.createInvite({
        email: trimmed,
        name: trimmed.split("@")[0] || "Invitee",
        role,
      });
      const recipient = email.trim();
      setEmail("");
      setNotice(result.inviteUrl ? `Invitation created in local email mode: ${result.inviteUrl}` : `Invitation sent to ${recipient}.`);
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to send invitation");
      onChanged();
    } finally {
      setSending(false);
    }
  };

  const resend = async (invite: Invitation) => {
    setNotice("");
    setError("");
    setBusyInviteId(invite.id);
    try {
      const result = await api.resendInvite(invite.id);
      setNotice(result.inviteUrl ? `Invitation recreated in local email mode: ${result.inviteUrl}` : `Invitation resent to ${invite.email}.`);
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to resend invitation");
    } finally {
      setBusyInviteId(null);
    }
  };

  const revoke = async (invite: Invitation) => {
    setNotice("");
    setError("");
    setBusyInviteId(invite.id);
    try {
      await api.revokeInvite(invite.id);
      setNotice(`Invitation to ${invite.email} revoked.`);
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to revoke invitation");
    } finally {
      setBusyInviteId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Link2 className="size-4" />Invitations</CardTitle>
        <CardDescription>Invite a colleague to create their own SalaryFlow account.</CardDescription>
        <CardAction><Badge variant="secondary">{pendingInvites.filter((invite) => invite.status === "pending").length} pending</Badge></CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-end">
          <Field>
            <FieldLabel htmlFor="invite-email">Email</FieldLabel>
            <Input id="invite-email" type="email" placeholder="colleague@company.com" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <Field>
            <FieldLabel>Role</FieldLabel>
            <Select value={role} onValueChange={(value) => setRole(value as "employee" | "admin")}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="employee">Employee</SelectItem><SelectItem value="admin">Administrator</SelectItem></SelectContent>
            </Select>
          </Field>
          <Button type="button" onClick={send} disabled={!email.trim() || sending}><MailPlus data-icon="inline-start" />{sending ? "Sending…" : "Send invitation"}</Button>
        </div>

        {notice && (
          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
            <CheckCircle2 />
            <AlertTitle>Invitation ready</AlertTitle>
            <AlertDescription className="break-all text-emerald-800">{notice}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive"><AlertCircle /><AlertTitle>Invitation failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
        )}

        {pendingInvites.length > 0 && (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Created</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {pendingInvites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell className="font-medium">{invite.email}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">{invite.role}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(invite.created_at).toLocaleDateString()}</TableCell>
                    <TableCell><StatusBadge status={invite.status} /></TableCell>
                    <TableCell className="text-right">
                      {invite.status === "pending" && (
                        <span className="inline-flex gap-1">
                          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Resend invitation to ${invite.email}`} disabled={busyInviteId === invite.id} onClick={() => { void resend(invite); }}>
                            <RotateCw />
                          </Button>
                          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Revoke invitation to ${invite.email}`} disabled={busyInviteId === invite.id} onClick={() => { void revoke(invite); }}>
                            <Trash2 />
                          </Button>
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
