import type { SupportedToken } from "./intents";
import type { Env } from "./types";

export type PaymentAttemptState =
  | "created"
  | "quoting"
  | "quoted"
  | "generating"
  | "awaiting_signature"
  | "submitting"
  | "submitted"
  | "awaiting_deposit"
  | "deposit_submitted"
  | "funding_quoted"
  | "funding_deposit_submitted"
  | "funding_processing"
  | "processing"
  | "confirmed"
  | "failed"
  | "refunded";

export type PaymentFlow = "standard" | "private";

/** States still in flight for pending-payments dock / cron. */
export const OPEN_PAYMENT_ATTEMPT_STATES: PaymentAttemptState[] = [
  "created",
  "quoting",
  "quoted",
  "generating",
  "awaiting_signature",
  "submitting",
  "submitted",
  "awaiting_deposit",
  "deposit_submitted",
  "funding_quoted",
  "funding_deposit_submitted",
  "funding_processing",
  "processing",
];

export const FUNDING_RECONCILE_STATES: PaymentAttemptState[] = [
  "funding_quoted",
  "funding_deposit_submitted",
  "funding_processing",
];

export type ConfidentialityLevel = "public" | "basic" | "advanced";

export function resolveConfidentiality(env: Env): ConfidentialityLevel {
  const raw = String(env.INTENTS_CONFIDENTIALITY || "advanced").trim().toLowerCase();
  if (raw === "public" || raw === "basic" || raw === "advanced") return raw;
  return "advanced";
}

export type ProviderPaymentStatus =
  | "PENDING_DEPOSIT"
  | "KNOWN_DEPOSIT_TX"
  | "INCOMPLETE_DEPOSIT"
  | "PROCESSING"
  | "SUCCESS"
  | "REFUNDED"
  | "FAILED";

export interface PaymentAssetMap {
  origin: Partial<Record<"USDC" | "USDT", PaymentAsset>>;
  destination: Record<string, Partial<Record<"USDC" | "USDT", PaymentAsset>>>;
}

export interface PaymentAsset {
  assetId: string;
  decimals: number;
}

export interface PaymentAssetValidationIssue {
  code: "ASSET_MAP_PROVIDER_MISMATCH";
  message: string;
}

export interface ExecutionGate {
  allowed: boolean;
  code?: "LIVE_PAYMENTS_DISABLED" | "LIVE_ACK_REQUIRED" | "INVALID_PROVIDER_URL";
  message?: string;
}

const OFFICIAL_PROVIDER_ORIGIN = "https://1click.chaindefuser.com";

export function executionGate(env: Env): ExecutionGate {
  if (env.PAYMENTS_MODE !== "live") {
    return {
      allowed: false,
      code: "LIVE_PAYMENTS_DISABLED",
      message: "Live payment execution is disabled",
    };
  }

  let provider: URL;
  try {
    provider = new URL(env.INTENTS_API_URL);
  } catch {
    return { allowed: false, code: "INVALID_PROVIDER_URL", message: "The payment provider URL is invalid" };
  }

  const isLoopback = provider.protocol === "http:" && ["127.0.0.1", "localhost"].includes(provider.hostname);
  if (isLoopback && env.PAYMENTS_EXECUTION_ACK === "local-test") return { allowed: true };
  if (provider.origin !== OFFICIAL_PROVIDER_ORIGIN) {
    return { allowed: false, code: "INVALID_PROVIDER_URL", message: "Live payments require the official 1Click API origin" };
  }
  if (env.PAYMENTS_EXECUTION_ACK !== "mainnet-live") {
    return { allowed: false, code: "LIVE_ACK_REQUIRED", message: "The explicit mainnet payment acknowledgement is missing" };
  }
  return { allowed: true };
}

export function parsePaymentAssetMap(value: string | undefined): PaymentAssetMap | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as PaymentAssetMap;
    if (!parsed || typeof parsed !== "object" || !parsed.origin || !parsed.destination) return null;
    return parsed;
  } catch {
    return null;
  }
}

function validAsset(asset: PaymentAsset | undefined): asset is PaymentAsset {
  return !!asset && typeof asset.assetId === "string" && asset.assetId.length > 0
    && Number.isInteger(asset.decimals) && asset.decimals >= 0 && asset.decimals <= 36;
}

export function resolvePaymentAssets(env: Env, token: string, network: string): { origin: PaymentAsset; destination: PaymentAsset } | null {
  if (token !== "USDC" && token !== "USDT") return null;
  const assets = parsePaymentAssetMap(env.INTENTS_ASSET_MAP);
  const origin = assets?.origin[token];
  const destination = assets?.destination[network]?.[token];
  return validAsset(origin) && validAsset(destination) ? { origin, destination } : null;
}

const PROVIDER_BLOCKCHAIN_BY_NETWORK: Record<string, string> = {
  Base: "base",
  Arbitrum: "arb",
  Polygon: "pol",
  Optimism: "op",
  Ethereum: "eth",
  "BNB Chain": "bsc",
};

export function validatePaymentAssetMapping(
  assets: { origin: PaymentAsset; destination: PaymentAsset },
  token: string,
  network: string,
  supportedTokens: SupportedToken[],
): PaymentAssetValidationIssue | null {
  const providerChain = PROVIDER_BLOCKCHAIN_BY_NETWORK[network];
  if (!providerChain) {
    return { code: "ASSET_MAP_PROVIDER_MISMATCH", message: `No provider blockchain mapping exists for ${network}` };
  }

  const validate = (kind: "origin" | "destination", configured: PaymentAsset): SupportedToken | PaymentAssetValidationIssue => {
    const matches = supportedTokens.filter((candidate) => candidate.assetId === configured.assetId);
    if (matches.length !== 1) {
      return {
        code: "ASSET_MAP_PROVIDER_MISMATCH",
        message: `${kind} asset ${configured.assetId} is not uniquely supported by 1Click`,
      };
    }
    const metadata = matches[0];
    if (metadata.decimals !== configured.decimals) {
      return {
        code: "ASSET_MAP_PROVIDER_MISMATCH",
        message: `${kind} asset ${configured.assetId} decimals mismatch: configured ${configured.decimals}, provider ${metadata.decimals}`,
      };
    }
    const providerSymbol = metadata.symbol.toUpperCase();
    const acceptedArbitrumUsdtAlias = kind === "destination"
      && network === "Arbitrum"
      && token === "USDT"
      && providerSymbol === "USDT0";
    if (providerSymbol !== token && !acceptedArbitrumUsdtAlias) {
      return {
        code: "ASSET_MAP_PROVIDER_MISMATCH",
        message: `${kind} asset ${configured.assetId} is ${metadata.symbol}, not ${token}`,
      };
    }
    return metadata;
  };

  const origin = validate("origin", assets.origin);
  if ("code" in origin) return origin;
  const destination = validate("destination", assets.destination);
  if ("code" in destination) return destination;
  if (destination.blockchain !== providerChain) {
    return {
      code: "ASSET_MAP_PROVIDER_MISMATCH",
      message: `destination asset ${assets.destination.assetId} is on ${destination.blockchain}, not ${providerChain}`,
    };
  }
  return null;
}

export function tokenMinorToAssetAmount(amountMinor: number, decimals: number): string | null {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || !Number.isInteger(decimals) || decimals < 0 || decimals > 36) return null;
  const amount = BigInt(amountMinor);
  if (decimals === 6) return amount.toString();
  if (decimals > 6) return (amount * 10n ** BigInt(decimals - 6)).toString();
  const divisor = 10n ** BigInt(6 - decimals);
  if (amount % divisor !== 0n) return null;
  return (amount / divisor).toString();
}

export function mapProviderStatus(status: string): PaymentAttemptState | null {
  if (status === "PENDING_DEPOSIT") return "awaiting_deposit";
  if (["KNOWN_DEPOSIT_TX", "INCOMPLETE_DEPOSIT", "PROCESSING"].includes(status)) return "processing";
  if (status === "SUCCESS") return "confirmed";
  if (status === "REFUNDED") return "refunded";
  if (status === "FAILED") return "failed";
  return null;
}

/** Provider rejected the signed intent before accepting it — safe to fail and re-quote. */
export function isDefinitiveSubmitFailure(message: string): boolean {
  const text = message.toLowerCase();
  return text.includes("quote has expired")
    || text.includes("quote expired")
    || text.includes("deadline has passed")
    || text.includes("intent is expired");
}

export function quoteRequestDeadlinePassed(quoteRequestJson: string | null | undefined): boolean {
  if (!quoteRequestJson) return false;
  try {
    const request = JSON.parse(quoteRequestJson) as { deadline?: string };
    const deadline = Date.parse(String(request.deadline || ""));
    return Number.isFinite(deadline) && deadline <= Date.now();
  } catch {
    return false;
  }
}

export function itemStatusForAttempt(state: PaymentAttemptState): "pending" | "processing" | "paid" | "failed" | "refunded" {
  if (state === "confirmed") return "paid";
  if (state === "failed") return "failed";
  if (state === "refunded") return "refunded";
  if ([
    "quoted",
    "generating",
    "awaiting_signature",
    "submitting",
    "submitted",
    "awaiting_deposit",
    "deposit_submitted",
    "funding_quoted",
    "funding_deposit_submitted",
    "funding_processing",
    "processing",
  ].includes(state)) {
    return "processing";
  }
  return "pending";
}

export function employeePaymentStatusForAttempt(
  state: PaymentAttemptState,
): "pending" | "processing" | "paid" | "failed" | "refunded" {
  return itemStatusForAttempt(state);
}

export async function syncPayrollRunStatus(db: D1Database, runId: string): Promise<string> {
  const stats = await db.prepare(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid,
            SUM(CASE WHEN status IN ('failed', 'refunded') THEN 1 ELSE 0 END) AS failed,
            SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processing
     FROM payrun_items WHERE run_id = ? AND removed_at IS NULL`,
  ).bind(runId).first<{ total: number; paid: number; failed: number; processing: number }>();
  const total = Number(stats?.total || 0);
  const paid = Number(stats?.paid || 0);
  const failed = Number(stats?.failed || 0);
  const processing = Number(stats?.processing || 0);
  let status = "draft";
  if (total > 0 && paid === total) status = "paid";
  else if (paid > 0 && failed > 0) status = "partial";
  else if (failed === total && total > 0) status = "failed";
  else if (processing > 0 || paid > 0) status = "processing";
  await db.prepare("UPDATE payroll_runs SET status = ?, updated_at = ? WHERE id = ?")
    .bind(status, new Date().toISOString(), runId).run();
  return status;
}
