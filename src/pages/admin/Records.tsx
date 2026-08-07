import { AlertCircle, CheckCircle2, Clock3, Copy, FileKey2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyPanel, MetricCard, PageHeader, StatusBadge, TokenCell } from "@/components/WorkspaceUI";
import { api } from "@/lib/api";
import { formatTokenAmount, useApi } from "@/lib/useData";

export function RecordsPage() {
  const { data, loading } = useApi(() => api.listRecords(), []);
  const records = data?.records ?? [];
  const confirmed = records.filter((record) => record.status === "confirmed").length;
  const inProgress = records.filter((record) => ["quoted", "submitted", "processing"].includes(record.status)).length;
  const failed = records.filter((record) => ["failed", "refunded"].includes(record.status)).length;

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Payment records"
        title="Every payment has a clear outcome"
        description="Confidential swap details stay private while intent hashes, provider state, and settlement timestamps remain auditable here."
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MetricCard label="Records" value={records.length} helper="All payment attempts" icon={<FileKey2 />} loading={loading} />
        <MetricCard label="Confirmed" value={confirmed} helper="Completed settlements" icon={<CheckCircle2 />} loading={loading} />
        <MetricCard label="In progress" value={inProgress} helper="Quoted or processing" icon={<Clock3 />} loading={loading} />
        <MetricCard label="Needs review" value={failed} helper="Failed or refunded" icon={<AlertCircle />} loading={loading} />
      </section>

      {loading ? (
        <Card><CardContent className="grid h-40 place-items-center text-sm text-muted-foreground">Loading payment records…</CardContent></Card>
      ) : records.length === 0 ? (
        <EmptyPanel title="No payment records yet" description="A record appears after a live payment creates an auditable execution attempt." />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Settlement records</CardTitle>
            <CardDescription>Intent hashes link each payment to its confidential settlement flow.</CardDescription>
            <CardAction><StatusBadge status="configured" label="Advanced confidentiality" /></CardAction>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Employee</TableHead>
                  <TableHead>Net amount</TableHead>
                  <TableHead>Token & network</TableHead>
                  <TableHead>Intent hash</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-4">Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="pl-4">
                      <span className="flex items-center gap-2.5">
                        <span className="grid size-8 place-items-center rounded-full bg-muted text-xs font-medium">{record.employee_name.slice(0, 2).toUpperCase()}</span>
                        <strong className="font-medium">{record.employee_name}</strong>
                      </span>
                    </TableCell>
                    <TableCell className="font-medium tabular-nums">{formatTokenAmount(record.amount_minor)} <small className="font-normal text-muted-foreground">{record.token}</small></TableCell>
                    <TableCell><TokenCell token={record.token} network={record.network} /></TableCell>
                    <TableCell>
                      {record.intent_hash ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="mono-value text-xs text-muted-foreground">{record.intent_hash.slice(0, 16)}…</span>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            type="button"
                            aria-label="Copy intent hash"
                            onClick={() => void navigator.clipboard.writeText(record.intent_hash || "")}
                          >
                            <Copy />
                          </Button>
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell><StatusBadge status={record.status} /></TableCell>
                    <TableCell className="pr-4 text-muted-foreground">
                      {record.submitted_at
                        ? new Date(record.submitted_at).toLocaleString()
                        : record.quote_at
                          ? new Date(record.quote_at).toLocaleString()
                          : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Alert>
        <AlertCircle />
        <AlertTitle>Confidential settlement boundary</AlertTitle>
        <AlertDescription>
          Swap execution remains private. Deposit and withdrawal transactions on external public chains stay visible where the network requires them.
        </AlertDescription>
      </Alert>
    </div>
  );
}
