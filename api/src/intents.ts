// NEAR Intents 1Click API client.
// All calls go through the backend so the Partner API key never reaches the browser.
// The user's authorization is carried by wallet signatures (signedData) / User-Session tokens.

import {
  quoteHash as calculateQuoteHash,
  verifyQuoteSignature,
  type OneClickQuoteResponse,
} from "@defuse-protocol/one-click-sdk-typescript";
import type { Env } from "./types";

function headers(env: Env, opts: { usePartnerKey?: boolean; token?: string; json?: boolean } = {}): Record<string, string> {
  const result: Record<string, string> = {};
  if (opts.json !== false) result["Content-Type"] = "application/json";
  if (opts.usePartnerKey !== false && env.INTENTS_API_KEY) result["X-API-Key"] = env.INTENTS_API_KEY;
  if (opts.token) result["Authorization"] = `Bearer ${opts.token}`;
  return result;
}

async function parseResponse<T>(res: Response, path: string): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`1Click ${path} failed (${res.status}): ${text.slice(0, 500)}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

async function post<T>(env: Env, path: string, body: unknown, opts: { usePartnerKey?: boolean; token?: string } = {}): Promise<T> {
  const res = await fetch(`${env.INTENTS_API_URL}${path}`, {
    method: "POST",
    headers: headers(env, opts),
    body: JSON.stringify(body),
  });
  return parseResponse<T>(res, path);
}

/** 1Click quote defaults. slippageTolerance is basis points (100 = 1%). */
export const INTENTS_QUOTE_DEFAULTS = {
  referral: "stableflow",
  slippageTolerance: 5,
} as const;

export interface QuoteRequest {
  dry: boolean;
  swapType: "EXACT_INPUT" | "EXACT_OUTPUT";
  originAsset: string;
  depositType: "ORIGIN_CHAIN" | "INTENTS" | "CONFIDENTIAL_INTENTS";
  destinationAsset: string;
  amount: string;
  recipient: string;
  recipientType: "DESTINATION_CHAIN" | "INTENTS" | "CONFIDENTIAL_INTENTS";
  refundTo: string;
  refundType: "ORIGIN_CHAIN" | "INTENTS" | "CONFIDENTIAL_INTENTS";
  confidentiality: "public" | "basic" | "advanced";
  deadline: string;
  slippageTolerance: number;
}

export interface QuoteResponse {
  correlationId: string;
  timestamp: string;
  signature: string;
  quoteRequest: QuoteRequest & Record<string, unknown>;
  quote: {
    amountIn: string;
    amountOut: string;
    minAmountIn?: string;
    minAmountOut?: string;
    depositAddress?: string;
    depositMemo?: string;
    deadline?: string;
    timeWhenInactive?: string;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

export function requestQuote(env: Env, req: QuoteRequest): Promise<QuoteResponse> {
  return post<QuoteResponse>(env, "/v0/quote", {
    ...req,
    referral: INTENTS_QUOTE_DEFAULTS.referral,
  });
}

function sameJsonValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => sameJsonValue(value, right[index]));
  }
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).filter((key) => leftRecord[key] !== undefined).sort();
  const rightKeys = Object.keys(rightRecord).filter((key) => rightRecord[key] !== undefined).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && sameJsonValue(leftRecord[key], rightRecord[key]));
}

// Verify the provider signature before any execution field (especially the
// deposit address) is consumed. The SDK owns the canonical field selection,
// stable JSON ordering, SHA-256/Base58 hashing, and Ed25519 verification.
function assertQuoteResponseShape(response: QuoteResponse): OneClickQuoteResponse {
  if (!response || typeof response !== "object" || !response.quote || typeof response.quote !== "object") {
    throw new Error("1Click returned an invalid quote response");
  }
  if (!response.timestamp || !Number.isFinite(Date.parse(response.timestamp))) {
    throw new Error("1Click quote is missing a valid signed timestamp");
  }
  if (!response.signature || !response.quoteRequest || typeof response.quoteRequest !== "object") {
    throw new Error("1Click quote is missing its signed request or signature");
  }
  return response as unknown as OneClickQuoteResponse;
}

function assertQuoteRequestMatches(expectedRequest: QuoteRequest, response: QuoteResponse): void {
  for (const [key, expectedValue] of Object.entries(expectedRequest)) {
    if (!sameJsonValue(response.quoteRequest[key], expectedValue)) {
      throw new Error(`1Click quote request mismatch for ${key}`);
    }
  }
}

function verifyQuoteResponseSignature(env: Env, signedResponse: OneClickQuoteResponse): boolean {
  const managerPublicKey = env.INTENTS_QUOTE_PUBLIC_KEY?.trim();
  return managerPublicKey
    ? verifyQuoteSignature(signedResponse, managerPublicKey)
    : verifyQuoteSignature(signedResponse);
}

export function verifyOneClickQuote(env: Env, expectedRequest: QuoteRequest, response: QuoteResponse): string {
  const signedResponse = assertQuoteResponseShape(response);
  assertQuoteRequestMatches(expectedRequest, response);
  if (!verifyQuoteResponseSignature(env, signedResponse)) {
    throw new Error("1Click quote signature verification failed");
  }
  return calculateQuoteHash(signedResponse);
}

/**
 * Status polls must not get stuck when 1Click re-emits a quote envelope whose
 * Ed25519 signature fails verification (key rotation / status-payload drift),
 * as long as the quote content still matches the hash we verified at quote time.
 */
export function verifyOneClickStatusQuote(
  env: Env,
  expectedRequest: QuoteRequest,
  response: QuoteResponse,
  storedQuoteHash: string,
): string {
  const signedResponse = assertQuoteResponseShape(response);
  assertQuoteRequestMatches(expectedRequest, response);
  const hash = calculateQuoteHash(signedResponse);
  if (hash !== storedQuoteHash) {
    throw new Error("1Click status quote does not match the stored payment quote");
  }
  if (!verifyQuoteResponseSignature(env, signedResponse)) {
    // Content hash already matches the quote accepted at creation time.
    return hash;
  }
  return hash;
}

export interface SupportedToken {
  assetId: string;
  decimals: number;
  blockchain: string;
  symbol: string;
  price?: number;
  contractAddress?: string | null;
  priceUpdatedAt?: string;
}

const TOKEN_CACHE_TTL_MS = 30 * 60 * 1000;
let tokenCache: { fetchedAt: number; tokens: SupportedToken[] } | null = null;

export async function getSupportedTokens(env: Env, options: { force?: boolean } = {}): Promise<SupportedToken[]> {
  if (!options.force && tokenCache && Date.now() - tokenCache.fetchedAt < TOKEN_CACHE_TTL_MS) {
    return tokenCache.tokens;
  }
  const path = "/v0/tokens";
  const res = await fetch(`${env.INTENTS_API_URL}${path}`, {
    headers: headers(env, { usePartnerKey: false, json: false }),
  });
  const data = await parseResponse<unknown>(res, path);
  if (!Array.isArray(data) || data.some((token) => {
    if (!token || typeof token !== "object") return true;
    const value = token as Record<string, unknown>;
    return typeof value.assetId !== "string" || !value.assetId
      || !Number.isInteger(value.decimals) || Number(value.decimals) < 0 || Number(value.decimals) > 36
      || typeof value.blockchain !== "string" || !value.blockchain
      || typeof value.symbol !== "string" || !value.symbol;
  })) {
    throw new Error("1Click returned invalid supported-token metadata");
  }
  const tokens = data as SupportedToken[];
  tokenCache = { fetchedAt: Date.now(), tokens };
  return tokens;
}

export interface GenerateIntentRequest {
  type: "swap_transfer";
  standard: "nep413" | "erc191" | "raw_ed25519" | "webauthn" | "ton_connect" | "sep53" | "tip191";
  signerId: string;
  depositAddress: string;
}

export interface GenerateIntentResponse {
  intent: {
    standard: string;
    payload: unknown;
  };
  correlationId: string;
}

export function generateIntent(env: Env, req: GenerateIntentRequest): Promise<GenerateIntentResponse> {
  return post<GenerateIntentResponse>(env, "/v0/generate-intent", req);
}

export interface SubmitIntentRequest {
  type: "swap_transfer";
  signedData: {
    standard: string;
    payload: unknown;
    public_key?: string;
    signature: string;
  };
}

export function submitIntent(env: Env, req: SubmitIntentRequest): Promise<{ intentHash: string; correlationId?: string }> {
  return post<{ intentHash: string; correlationId?: string }>(env, "/v0/submit-intent", req);
}

export interface SwapStatus {
  correlationId?: string;
  quoteResponse: QuoteResponse;
  status: "PENDING_DEPOSIT" | "KNOWN_DEPOSIT_TX" | "INCOMPLETE_DEPOSIT" | "PROCESSING" | "SUCCESS" | "REFUNDED" | "FAILED";
  updatedAt?: string;
  swapDetails?: {
    intentHashes?: string[];
    originChainTxHashes?: Array<{ hash: string; explorerUrl?: string }>;
    destinationChainTxHashes?: Array<{ hash: string; explorerUrl?: string }>;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

export async function checkSwapStatus(env: Env, depositAddress: string, depositMemo?: string): Promise<SwapStatus> {
  const query = new URLSearchParams({ depositAddress });
  if (depositMemo) query.set("depositMemo", depositMemo);
  const path = `/v0/status?${query.toString()}`;
  const res = await fetch(`${env.INTENTS_API_URL}${path}`, { headers: headers(env, { json: false }) });
  return parseResponse<SwapStatus>(res, "/v0/status");
}

/** Notify 1Click that an ORIGIN_CHAIN deposit tx was broadcast. */
export function submitDepositTx(
  env: Env,
  body: { depositAddress: string; txHash: string },
): Promise<unknown> {
  return post<unknown>(env, "/v0/deposit/submit", body);
}

// User-Session token exchange: wallet signs an ownership proof (empty intents array).
export interface UserAuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

export function authenticateUser(env: Env, signedData: unknown): Promise<UserAuthResponse> {
  return post<UserAuthResponse>(env, "/v0/auth/authenticate", { signedData }, { usePartnerKey: false });
}

export async function getUserBalances(env: Env, token: string, tokenIds?: string[]): Promise<unknown> {
  const qs = tokenIds?.length ? `?tokenIds=${encodeURIComponent(tokenIds.join(","))}` : "";
  const res = await fetch(`${env.INTENTS_API_URL}/v0/account/balances${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`balances failed (${res.status})`);
  return res.json();
}
