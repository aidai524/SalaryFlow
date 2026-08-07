import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, type Employee, type PayrollImportRow } from "@/lib/api";
import { employeesToPayrollCsv, parsePayrollCsv, PAYROLL_DEMO_CSV } from "@/lib/payroll-import";
import { isValidTokenAmount } from "@/lib/useData";

const SUPPORTED_NETWORKS = new Set(["Base", "Arbitrum", "Polygon", "Optimism", "Ethereum"]);

type PreviewRow = PayrollImportRow & {
  rowNumber: number;
  employee: Employee | null;
  kind: "linked" | "manual" | "invalid";
  error: string | null;
};

function previewRows(rows: PayrollImportRow[], employees: Employee[]): PreviewRow[] {
  const directory = new Map(employees.filter((employee) => employee.email).map((employee) => [employee.email!.toLowerCase(), employee]));
  return rows.map((row, index) => {
    const employee = row.employeeEmail ? directory.get(row.employeeEmail.toLowerCase()) ?? null : null;
    let error: string | null = null;
    if (!isValidTokenAmount(row.amount)) error = "Amount must be positive with up to 6 decimals";
    else if (!row.employeeEmail && !row.employeeName) error = "Add an employee email or a manual recipient name";
    else if (row.employeeEmail && !employee) error = "No employee matches this email";
    else if (!(["USDC", "USDT"] as string[]).includes(row.token)) error = "Token must be USDC or USDT";
    else if (!SUPPORTED_NETWORKS.has(row.network)) error = "Unsupported network";
    else if (employee && row.token !== employee.token) error = `Employee payout token is ${employee.token}`;
    else if (employee && row.network !== employee.network) error = `Employee payout network is ${employee.network}`;
    return {
      ...row,
      rowNumber: index + 2,
      employee,
      kind: error ? "invalid" : employee ? "linked" : "manual",
      error,
    };
  });
}

function downloadCsv(content: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function PayrollImportDialog({
  open,
  onOpenChange,
  runId,
  employees,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runId: string;
  employees: Employee[];
  onImported: () => Promise<void>;
}) {
  const [csv, setCsv] = useState(PAYROLL_DEMO_CSV);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const parsed = useMemo(() => {
    try {
      const rows = parsePayrollCsv(csv);
      return { rows: previewRows(rows, employees), error: null };
    } catch (error) {
      return { rows: [] as PreviewRow[], error: error instanceof Error ? error.message : "Unable to read CSV" };
    }
  }, [csv, employees]);
  const error = parseError || parsed.error;
  const invalidCount = parsed.rows.filter((row) => row.kind === "invalid").length;
  const manualCount = parsed.rows.filter((row) => row.kind === "manual").length;

  const useDirectory = () => {
    setCsv(employeesToPayrollCsv(employees));
    setParseError(null);
    setMessage(employees.length ? `Added ${employees.length} employee${employees.length === 1 ? "" : "s"} from the directory.` : "The employee directory is empty.");
  };

  const importRows = async () => {
    setParseError(null);
    setMessage(null);
    if (parsed.error) return;
    if (parsed.rows.length === 0) {
      setParseError("Add at least one data row before importing.");
      return;
    }
    if (invalidCount > 0) {
      setParseError(`Fix ${invalidCount} invalid row${invalidCount === 1 ? "" : "s"} before importing.`);
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.importPayrollItems(runId, parsed.rows.map(({ rowNumber: _rowNumber, employee: _employee, kind: _kind, error: _error, ...row }) => row));
      await onImported();
      onOpenChange(false);
      setMessage(`Imported ${result.importedCount} payments.`);
    } catch (caught) {
      setParseError(caught instanceof Error ? caught.message : "Import failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import payroll payments</DialogTitle>
          <DialogDescription>Upload or paste CSV, review every row, then import up to 200 payments into this draft run.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <section className="rounded-lg border bg-muted/20 p-3" aria-labelledby="csv-format-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 id="csv-format-title" className="font-medium">CSV format demo</h3>
                <p className="mt-1 text-xs text-muted-foreground">Email links an existing employee. Leave email blank only for a manual, not-yet-payable draft recipient.</p>
              </div>
              <Button variant="outline" size="sm" type="button" onClick={() => downloadCsv(PAYROLL_DEMO_CSV, "salaryflow-payroll-example.csv")}>
                <Download data-icon="inline-start" />Download example
              </Button>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-md bg-background p-3 text-xs leading-5"><code>{PAYROLL_DEMO_CSV}</code></pre>
          </section>

          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent">
              <Upload className="size-4" aria-hidden="true" />Upload CSV
              <input
                className="sr-only"
                type="file"
                accept=".csv,text/csv"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setCsv(await file.text());
                  setParseError(null);
                  setMessage(`Loaded ${file.name}`);
                  event.target.value = "";
                }}
              />
            </label>
            <Button variant="outline" type="button" onClick={useDirectory}>
              <FileSpreadsheet data-icon="inline-start" />Fill from employee directory
            </Button>
          </div>

          <div>
            <label htmlFor="payroll-csv" className="mb-2 block text-sm font-medium">CSV data</label>
            <textarea
              id="payroll-csv"
              value={csv}
              onChange={(event) => { setCsv(event.target.value); setParseError(null); setMessage(null); }}
              aria-invalid={!!error}
              aria-describedby="payroll-csv-help payroll-csv-status"
              spellCheck={false}
              className="min-h-36 w-full resize-y rounded-md border bg-transparent px-3 py-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
            />
            <p id="payroll-csv-help" className="mt-1 text-xs text-muted-foreground">Required columns: employee_email, employee_name, amount, token, network.</p>
          </div>

          {error && <Alert variant="destructive" id="payroll-csv-status"><AlertTitle>Import needs attention</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          {!error && message && <Alert id="payroll-csv-status"><AlertTitle>CSV ready</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>}

          <section aria-labelledby="import-preview-title">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 id="import-preview-title" className="font-medium">Preview</h3>
              <Badge variant="secondary">{parsed.rows.length} rows</Badge>
              {manualCount > 0 && <Badge variant="outline">{manualCount} manual</Badge>}
              {invalidCount > 0 && <Badge variant="destructive">{invalidCount} invalid</Badge>}
            </div>
            <div className="max-h-60 overflow-auto rounded-lg border">
              <Table>
                <TableHeader><TableRow><TableHead>Row</TableHead><TableHead>Recipient</TableHead><TableHead>Amount</TableHead><TableHead>Route</TableHead><TableHead>Result</TableHead></TableRow></TableHeader>
                <TableBody>
                  {parsed.rows.map((row) => (
                    <TableRow key={row.rowNumber}>
                      <TableCell>{row.rowNumber}</TableCell>
                      <TableCell><div className="font-medium">{row.employee?.name || row.employeeName || "—"}</div><div className="text-xs text-muted-foreground">{row.employeeEmail || "No email"}</div></TableCell>
                      <TableCell className="tabular-nums">{row.amount || "—"}</TableCell>
                      <TableCell>{row.token || "—"} · {row.network || "—"}</TableCell>
                      <TableCell>
                        {row.kind === "linked" && <Badge variant="secondary">Linked employee</Badge>}
                        {row.kind === "manual" && <div><Badge variant="outline">Manual draft</Badge><p className="mt-1 text-xs text-muted-foreground">Not payable until linked</p></div>}
                        {row.kind === "invalid" && <p className="max-w-56 text-xs text-destructive">{row.error}</p>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {parsed.rows.length === 0 && <TableRow><TableCell colSpan={5} className="h-20 text-center text-muted-foreground">No data rows to preview.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={importRows} disabled={submitting}>{submitting ? "Importing…" : `Import ${parsed.rows.length} payments`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
