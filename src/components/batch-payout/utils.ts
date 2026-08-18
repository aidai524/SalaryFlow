import { keccak256, stringToHex, type Address, type Hex } from "viem";
import { getChainByNetwork } from "@/config/chains";
import type { Employee } from "@/lib/api";
import { parsePositiveDecimal } from "@/lib/amount-input";
import { formatTokenMinor } from "@/lib/format";
import type { IntentsToken, StableSymbol } from "@/stores/intents-tokens";

export interface BatchDraft {
  employee: Employee;
  amount: string;
  memo: string;
  destToken: IntentsToken | null;
}

export type BatchDraftPatch = Partial<Pick<BatchDraft, "amount" | "memo" | "destToken">>;

export function defaultAmountForEmployee(employee: Employee): string {
  if (!employee.amount_minor || employee.amount_minor <= 0) return "";
  return formatTokenMinor(employee.amount_minor, { maximumFractionDigits: 6 }).replace(/,/g, "");
}

export function destTokenForEmployee(
  employee: Employee,
  findByChainAndSymbol: (blockchain: string, symbol: StableSymbol) => IntentsToken | undefined,
): IntentsToken | null {
  const chain = getChainByNetwork(employee.network);
  if (!chain) return null;
  return findByChainAndSymbol(chain.blockchain, employee.token) ?? null;
}

export function draftDestination(row: BatchDraft): {
  symbol: StableSymbol;
  network: string;
  decimals: number;
} {
  return {
    symbol: row.destToken?.symbol ?? row.employee.token,
    network: row.destToken?.chain.chainName ?? row.employee.network,
    decimals: row.destToken?.decimals ?? 6,
  };
}

export function validateDraftAmount(amount: string, maxDecimals = 6): string | null {
  return parsePositiveDecimal(amount, maxDecimals);
}

export function allDraftsValid(drafts: BatchDraft[]): boolean {
  return drafts.length > 0 && drafts.every((row) => (
    validateDraftAmount(row.amount, draftDestination(row).decimals)
  ));
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
