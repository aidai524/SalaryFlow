import { useEffect } from "react";
import {
  ArrowRight,
  CalendarDays,
  CircleDollarSign,
  FileCheck2,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MetricCard, PageHeader, StatusBadge } from "@/components/WorkspaceUI";
import { api, type AuthUser, type PayrollRun } from "@/lib/api";
import { formatTokenAmount, useApi } from "@/lib/useData";

export function OverviewPage({
  user,
  onNavigate,
}: {
  user: AuthUser;
  onNavigate: (screen: string) => void;
}) {
  const { data: runs, loading: runsLoading } = useApi(() => api.listRuns(), []);
  const { data: employees, loading: employeesLoading } = useApi(() => api.listEmployees(), []);
  const { data: records, loading: recordsLoading } = useApi(() => api.listRecords(), []);

  useEffect(() => {
    document.title = "SalaryFlow · Overview";
  }, []);

  const latest = runs?.runs[0] as PayrollRun | undefined;
  const readyCount = employees?.employees.filter((employee) => employee.status === "ready").length ?? 0;
  const employeeCount = employees?.employees.length ?? 0;
  const attentionCount = Math.max(0, employeeCount - readyCount);
  const confirmedRecords = records?.records.filter((record) => record.status === "confirmed").length ?? 0;
  const progress = latest?.status === "paid" ? 100 : latest?.status === "processing" ? 75 : latest ? 50 : 0;

  return (
    <div className="page-container">
      <PageHeader
        eyebrow={new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        title="Overview"
        description={`Welcome back, ${user.name.split(" ")[0]}. Review the next payroll run and your team’s payout readiness.`}
        actions={(
          <Button type="button" onClick={() => onNavigate("payroll")}>
            <CircleDollarSign data-icon="inline-start" />
            Open payroll
          </Button>
        )}
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" aria-label="Payroll metrics">
        <MetricCard
          label="Next pay date"
          value={latest?.pay_date ? new Date(`${latest.pay_date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
          helper={latest?.label ?? "No payroll run scheduled"}
          icon={<CalendarDays />}
          loading={runsLoading}
        />
        <MetricCard
          label="Latest payroll"
          value={`${formatTokenAmount(latest?.usdcMinor ?? 0)} USDC`}
          helper={`${formatTokenAmount(latest?.usdtMinor ?? 0)} USDT in the same run`}
          icon={<CircleDollarSign />}
          loading={runsLoading}
        />
        <MetricCard
          label="Payout readiness"
          value={`${readyCount} of ${employeeCount}`}
          helper={attentionCount === 0 ? "All team members are ready" : `${attentionCount} need an update`}
          icon={<UsersRound />}
          loading={employeesLoading}
        />
        <MetricCard
          label="Confirmed records"
          value={confirmedRecords}
          helper={`${records?.records.length ?? 0} total payment records`}
          icon={<FileCheck2 />}
          loading={recordsLoading}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Current payroll run</CardTitle>
            <CardDescription>Latest scheduled batch and token totals.</CardDescription>
            <CardAction>
              {latest ? <StatusBadge status={latest.status} /> : <Badge variant="outline">No run</Badge>}
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-5">
            {latest ? (
              <>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="font-heading text-xl font-semibold tracking-tight">{latest.label}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {latest.pay_date} · {latest.itemCount} {latest.itemCount === 1 ? "payment" : "payments"}
                    </p>
                  </div>
                  <div className="flex gap-6 sm:text-right">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">USDC</p>
                      <p className="mt-1 font-heading text-lg font-semibold tabular-nums">{formatTokenAmount(latest.usdcMinor)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">USDT</p>
                      <p className="mt-1 font-heading text-lg font-semibold tabular-nums">{formatTokenAmount(latest.usdtMinor)}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Run progress</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="grid grid-cols-3 text-xs text-muted-foreground">
                    <span>Created</span>
                    <span className="text-center">Payouts checked</span>
                    <span className="text-right">Confirmed</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-8 text-center">
                <p className="font-medium">No payroll runs yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Create the first run from Payroll.</p>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between">
            <span className="text-xs text-muted-foreground">Amounts retain six-decimal stablecoin precision.</span>
            <Button variant="ghost" size="sm" onClick={() => onNavigate("payroll")}>
              View details
              <ArrowRight data-icon="inline-end" />
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payout readiness</CardTitle>
            <CardDescription>Resolve blockers before a payment preflight.</CardDescription>
            <CardAction>
              <span className="grid size-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                <ShieldCheck className="size-4" />
              </span>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-1">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-lg px-2 py-3 text-left transition-colors hover:bg-muted"
              onClick={() => onNavigate("people")}
            >
              <span>
                <strong className="block text-sm font-medium">{readyCount} ready to pay</strong>
                <small className="text-xs text-muted-foreground">Verified payout methods</small>
              </span>
              <ArrowRight className="size-4 text-muted-foreground" />
            </button>
            <Separator />
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-lg px-2 py-3 text-left transition-colors hover:bg-muted"
              onClick={() => onNavigate("people")}
            >
              <span>
                <strong className="block text-sm font-medium">{attentionCount} need attention</strong>
                <small className="text-xs text-muted-foreground">Address or ownership verification</small>
              </span>
              <ArrowRight className="size-4 text-muted-foreground" />
            </button>
            <Separator />
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-lg px-2 py-3 text-left transition-colors hover:bg-muted"
              onClick={() => onNavigate("records")}
            >
              <span>
                <strong className="block text-sm font-medium">{confirmedRecords} confirmed on-chain</strong>
                <small className="text-xs text-muted-foreground">Open payment records</small>
              </span>
              <ArrowRight className="size-4 text-muted-foreground" />
            </button>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Recent payroll runs</CardTitle>
          <CardDescription>Latest batches across USDC and USDT.</CardDescription>
          <CardAction>
            <Button variant="outline" size="sm" onClick={() => onNavigate("payroll")}>View all</Button>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Run</TableHead>
                <TableHead>Pay date</TableHead>
                <TableHead>Payments</TableHead>
                <TableHead>USDC</TableHead>
                <TableHead>USDT</TableHead>
                <TableHead className="pr-4 text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(runs?.runs ?? []).slice(0, 5).map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="pl-4 font-medium">{run.label}</TableCell>
                  <TableCell className="text-muted-foreground">{run.pay_date}</TableCell>
                  <TableCell>{run.itemCount}</TableCell>
                  <TableCell className="tabular-nums">{formatTokenAmount(run.usdcMinor)}</TableCell>
                  <TableCell className="tabular-nums">{formatTokenAmount(run.usdtMinor)}</TableCell>
                  <TableCell className="pr-4 text-right"><StatusBadge status={run.status} /></TableCell>
                </TableRow>
              ))}
              {!runsLoading && (runs?.runs.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">No payroll runs yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
