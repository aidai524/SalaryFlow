// NEAR Intents 1Click API client.
// All calls go through the backend so the Partner API key never reaches the browser.
// The user's authorization is carried by wallet signatures (signedData) / User-Session tokens.

import type { Env } from "./types";

async function call<T>(env: Env, path: string, body: unknown, opts: { usePartnerKey?: boolean; token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.usePartnerKey !== false && env.INTENTS_API_KEY) {
    headers["X-API-Key"] = env.INTENTS_API_KEY;
  }
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
  const res = await fetch(`${env.INTENTS_API_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
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
  slippageTolerance?: number;
}

export interface QuoteResponse {
  quoteHash: string;
  depositAddress?: string;
  depositMemo?: string;
  amountIn: string;
  amountOut: string;
  minAmountOut?: string;
  deadline?: string;
  [k: string]: unknown;
}

export function requestQuote(env: Env, req: QuoteRequest): Promise<QuoteResponse> {
  return call<QuoteResponse>(env, "/v0/quote", req);
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
  return call<GenerateIntentResponse>(env, "/v0/generate-intent", req);
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

export function submitIntent(env: Env, req: SubmitIntentRequest): Promise<{ intentHash: string }> {
  return call<{ intentHash: string }>(env, "/v0/submit-intent", req);
}

export interface SwapStatus {
  status: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
  [k: string]: unknown;
}

export async function checkSwapStatus(env: Env, depositAddress: string, depositMemo?: string): Promise<SwapStatus> {
  const body: Record<string, unknown> = { depositAddress };
  if (depositMemo) body["depositMemo"] = depositMemo;
  return call<SwapStatus>(env, "/v0/status", body);
}

// User-Session token exchange: wallet signs an ownership proof (empty intents array).
export interface UserAuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

export function authenticateUser(env: Env, signedData: unknown): Promise<UserAuthResponse> {
  return call<UserAuthResponse>(env, "/v0/auth/authenticate", { signedData }, { usePartnerKey: false });
}

export async function getUserBalances(env: Env, token: string, tokenIds?: string[]): Promise<unknown> {
  const qs = tokenIds?.length ? `?tokenIds=${encodeURIComponent(tokenIds.join(","))}` : "";
  const res = await fetch(`${env.INTENTS_API_URL}/v0/account/balances${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`balances failed (${res.status})`);
  return res.json();
}
