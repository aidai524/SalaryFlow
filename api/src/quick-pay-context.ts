// HMAC-signed Quick Pay context tokens. Live quotes return a signed blob so the
// client can complete wallet signing / deposit before any DB row is created.
// Commit verifies the token and persists in one shot.

import type { QuoteRequest, QuoteResponse } from "./intents";
import type { Env } from "./types";

const CONTEXT_TTL_MS = 24 * 60 * 60 * 1000;
const CONTEXT_VERSION = 1 as const;

export type QuickPayMode = "private" | "standard";

export interface QuickPayContextPayload {
  v: typeof CONTEXT_VERSION;
  exp: number;
  orgId: string;
  userId: string;
  signerId: string;
  employeeId: string;
  employeeName: string;
  paymentId: string;
  attemptId: string;
  idempotencyKey: string;
  mode: QuickPayMode;
  amountMinor: number;
  token: string;
  network: string;
  recipient: string;
  originAssetId: string;
  destinationAssetId: string;
  originNetwork: string;
  destinationNetwork: string;
  confidentiality: string;
  quoteRequest: QuoteRequest;
  quoteResponse: QuoteResponse;
  quoteHash: string;
  depositAddress: string;
  depositMemo: string | null;
  quoteExpiresAt: string;
  /** Private: ERC-191 intent object JSON string. */
  intentPayload?: string | null;
  fundingQuoteRequest?: QuoteRequest | null;
  fundingQuoteResponse?: QuoteResponse | null;
  fundingQuoteHash?: string | null;
  fundingDepositAddress?: string | null;
  fundingDepositMemo?: string | null;
  fundingExpiresAt?: string | null;
}

export type QuickPayContextErrorCode =
  | "QUICK_PAY_CONTEXT_INVALID"
  | "QUICK_PAY_CONTEXT_EXPIRED"
  | "QUICK_PAY_CONTEXT_ORG_MISMATCH"
  | "QUICK_PAY_CONTEXT_SIGNER_MISMATCH";

export class QuickPayContextError extends Error {
  code: QuickPayContextErrorCode;
  constructor(code: QuickPayContextErrorCode, message: string) {
    super(message);
    this.name = "QuickPayContextError";
    this.code = code;
  }
}

let hmacKeyPromise: Promise<CryptoKey> | null = null;
let hmacSecret = "";

function contextHmacKey(env: Env): Promise<CryptoKey> {
  const secretVal = env.JWT_SECRET;
  if (!secretVal) throw new Error("JWT_SECRET is not configured");
  if (!hmacKeyPromise || hmacSecret !== secretVal) {
    hmacSecret = secretVal;
    hmacKeyPromise = (async () => {
      // Domain-separate from JWT signing so a leaked context cannot forge sessions.
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(`quick-pay-context:${secretVal}`),
      );
      return crypto.subtle.importKey("raw", digest, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
    })();
  }
  return hmacKeyPromise;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function signQuickPayContext(
  env: Env,
  payload: Omit<QuickPayContextPayload, "v" | "exp"> & { exp?: number },
): Promise<string> {
  const body: QuickPayContextPayload = {
    ...payload,
    v: CONTEXT_VERSION,
    exp: payload.exp ?? Date.now() + CONTEXT_TTL_MS,
  };
  const json = JSON.stringify(body);
  const key = await contextHmacKey(env);
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(json)),
  );
  return `${bytesToBase64Url(new TextEncoder().encode(json))}.${bytesToBase64Url(signature)}`;
}

export async function verifyQuickPayContext(
  env: Env,
  token: string,
  expected: { orgId: string; signerId: string },
): Promise<QuickPayContextPayload> {
  const parts = String(token || "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new QuickPayContextError("QUICK_PAY_CONTEXT_INVALID", "Quick Pay context token is malformed");
  }
  let json: string;
  let providedSig: Uint8Array;
  try {
    json = new TextDecoder().decode(base64UrlToBytes(parts[0]));
    providedSig = base64UrlToBytes(parts[1]);
  } catch {
    throw new QuickPayContextError("QUICK_PAY_CONTEXT_INVALID", "Quick Pay context token is malformed");
  }

  const key = await contextHmacKey(env);
  const expectedSig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(json)),
  );
  if (!timingSafeEqual(providedSig, expectedSig)) {
    throw new QuickPayContextError("QUICK_PAY_CONTEXT_INVALID", "Quick Pay context signature is invalid");
  }

  let payload: QuickPayContextPayload;
  try {
    payload = JSON.parse(json) as QuickPayContextPayload;
  } catch {
    throw new QuickPayContextError("QUICK_PAY_CONTEXT_INVALID", "Quick Pay context payload is invalid");
  }

  if (payload.v !== CONTEXT_VERSION || !payload.orgId || !payload.attemptId || !payload.idempotencyKey) {
    throw new QuickPayContextError("QUICK_PAY_CONTEXT_INVALID", "Quick Pay context payload is incomplete");
  }
  if (!Number.isFinite(payload.exp) || payload.exp <= Date.now()) {
    throw new QuickPayContextError("QUICK_PAY_CONTEXT_EXPIRED", "Quick Pay context token has expired");
  }
  if (payload.orgId !== expected.orgId) {
    throw new QuickPayContextError(
      "QUICK_PAY_CONTEXT_ORG_MISMATCH",
      "Quick Pay context belongs to another organization",
    );
  }
  if (String(payload.signerId || "").toLowerCase() !== String(expected.signerId || "").toLowerCase()) {
    throw new QuickPayContextError(
      "QUICK_PAY_CONTEXT_SIGNER_MISMATCH",
      "Quick Pay context belongs to another payment wallet",
    );
  }
  return payload;
}

export const QUICK_PAY_CONTEXT_TTL_MS = CONTEXT_TTL_MS;
