// Password hashing (PBKDF2 via WebCrypto — available in Cloudflare Workers)
// and JWT signing/verification (HMAC-SHA256 via jose)

import { SignJWT, jwtVerify } from "jose";
import type { Env, JwtPayload } from "./types";

// Cloudflare Workers' production runtime caps PBKDF2 at 100,000 iterations.
// Keep this value at or below the platform limit; each stored hash records its
// own iteration count so a future authentication backend can migrate safely.
export const CLOUDFLARE_PBKDF2_MAX_ITERATIONS = 100_000;
export const PBKDF2_ITERATIONS = 100_000;
const enc = new TextEncoder();

if (PBKDF2_ITERATIONS > CLOUDFLARE_PBKDF2_MAX_ITERATIONS) {
  throw new Error("PBKDF2 iteration count exceeds the Cloudflare Workers limit");
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return `pbkdf2:${PBKDF2_ITERATIONS}:${toHex(salt.buffer)}:${toHex(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterStr, saltHex, hashHex] = stored.split(":");
  if (scheme !== "pbkdf2" || !saltHex || !hashHex) return false;
  const iterations = parseInt(iterStr, 10) || PBKDF2_ITERATIONS;
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256,
  );
  const computed = toHex(bits);
  if (computed.length !== hashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ hashHex.charCodeAt(i);
  return diff === 0;
}

/** Cryptographically random password (never returned to clients). */
export function generateRandomPassword(byteLength = 24): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return toHex(bytes.buffer);
}

let hmacKeyPromise: Promise<CryptoKey> | null = null;
let hmacSecret = "";

function hmacKey(env: Env): Promise<CryptoKey> {
  const secretVal = env.JWT_SECRET;
  if (!secretVal) throw new Error("JWT_SECRET is not configured");
  if (!hmacKeyPromise || hmacSecret !== secretVal) {
    hmacSecret = secretVal;
    hmacKeyPromise = (async () => {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secretVal));
      return crypto.subtle.importKey("raw", digest, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
    })();
  }
  return hmacKeyPromise;
}

export async function signToken(payload: Omit<JwtPayload, "iat" | "exp">, env: Env, ttlSec = 60 * 60 * 24 * 7): Promise<string> {
  const key = await hmacKey(env);
  return new SignJWT({ sub: payload.sub, org: payload.org, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSec)
    .sign(key);
}

export async function verifyToken(token: string, env: Env): Promise<JwtPayload | null> {
  try {
    const key = await hmacKey(env);
    const { payload } = await jwtVerify(token, key);
    return {
      sub: payload.sub as string,
      org: (payload.org as string | null) ?? null,
      role: (payload.role as "admin" | "employee") ?? "employee",
      exp: payload.exp as number,
      iat: payload.iat as number,
    };
  } catch {
    return null;
  }
}
