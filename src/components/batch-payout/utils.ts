import { keccak256, stringToHex, type Address, type Hex } from "viem";
import type { Employee } from "@/lib/api";
import { parsePositiveDecimal } from "@/lib/amount-input";
import { formatTokenMinor } from "@/lib/format";

export interface BatchDraft {
  employee: Employee;
  amount: string;
  memo: string;
}

export function defaultAmountForEmployee(employee: Employee): string {
  if (!employee.amount_minor || employee.amount_minor <= 0) return "";
  return formatTokenMinor(employee.amount_minor, { maximumFractionDigits: 6 }).replace(/,/g, "");
}

export function validateDraftAmount(amount: string): string | null {
  return parsePositiveDecimal(amount, 6);
}

export function allDraftsValid(drafts: BatchDraft[]): boolean {
  return drafts.length > 0 && drafts.every((row) => validateDraftAmount(row.amount));
}

export function makeBatchId(depositAddresses: string[], originAssetId: string): Hex {
  const sorted = [...depositAddresses].map((a) => a.toLowerCase()).sort();
  const payload = `${originAssetId}:${sorted.join(",")}:${crypto.randomUUID()}`;
  return keccak256(stringToHex(payload));
}

export function minQuoteDeadlineUnix(deadlines: Array<string | null | undefined>): bigint {
  let min = BigInt(Math.floor(Date.now() / 1000) + 10 * 60);
  for (const raw of deadlines) {
    const parsed = raw ? Date.parse(String(raw)) : NaN;
    if (!Number.isFinite(parsed) || parsed <= Date.now()) continue;
    const unix = BigInt(Math.floor(parsed / 1000));
    if (unix < min) min = unix;
  }
  return min;
}

export function asAddress(value: string): Address {
  return value as Address;
}
