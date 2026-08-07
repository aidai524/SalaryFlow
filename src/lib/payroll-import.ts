import type { Employee, PayrollImportRow } from "@/lib/api";

export const PAYROLL_CSV_HEADERS = ["employee_email", "employee_name", "amount", "token", "network"] as const;

export const PAYROLL_DEMO_CSV = [
  PAYROLL_CSV_HEADERS.join(","),
  "alex@company.com,Alex Chen,2500.00,USDC,Base",
  ",External contractor,850.50,USDT,Arbitrum",
].join("\n");

function parseCsvRows(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (quoted) throw new Error("Close the quoted CSV value before importing");
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function escapeCsv(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function parsePayrollCsv(source: string): PayrollImportRow[] {
  const rows = parseCsvRows(source.replace(/^\uFEFF/, ""));
  if (rows.length === 0) return [];
  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const missing = PAYROLL_CSV_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length > 0) throw new Error(`Add the required columns: ${missing.join(", ")}`);
  const indexByHeader = new Map(headers.map((header, index) => [header, index]));
  const value = (row: string[], header: typeof PAYROLL_CSV_HEADERS[number]) => row[indexByHeader.get(header) ?? -1]?.trim() ?? "";
  return rows.slice(1).map((row) => ({
    employeeEmail: value(row, "employee_email").toLowerCase(),
    employeeName: value(row, "employee_name"),
    amount: value(row, "amount"),
    token: value(row, "token").toUpperCase(),
    network: value(row, "network"),
  }));
}

export function minorAmountToCsv(valueMinor: number): string {
  const whole = Math.trunc(valueMinor / 1_000_000);
  const fraction = String(Math.abs(valueMinor % 1_000_000)).padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

export function employeesToPayrollCsv(employees: Employee[]): string {
  const rows = employees.map((employee) => [
    employee.email || "",
    employee.name,
    minorAmountToCsv(employee.amount_minor),
    employee.token,
    employee.network,
  ].map((value) => escapeCsv(String(value))).join(","));
  return [PAYROLL_CSV_HEADERS.join(","), ...rows].join("\n");
}
