// Shared request/response types and D1 binding types

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  APP_URL: string;
  API_URL: string;
  COOKIE_DOMAIN: string;
  RESEND_API_KEY?: string;
  SENDER_EMAIL?: string;
  MOCK_EMAIL?: string;
  INTENTS_API_URL: string;
  INTENTS_API_KEY?: string;
  /** @deprecated Prefer dynamic /v0/tokens resolution. Kept for legacy payroll-run quotes. */
  INTENTS_ASSET_MAP?: string;
  INTENTS_QUOTE_PUBLIC_KEY?: string;
  /** Confidential swap level for ORIGIN_CHAIN quotes: public | basic | advanced. Default advanced. */
  INTENTS_CONFIDENTIALITY?: string;
  PAYMENTS_MODE?: "disabled" | "dry-run" | "live";
  PAYMENTS_EXECUTION_ACK?: "local-test" | "mainnet-live";
}

export type Role = "admin" | "employee";
export type UserStatus = "invited" | "active" | "disabled";

export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: Role;
  status: UserStatus;
  org_id: string | null;
  wallet_address: string | null;
  wallet_verified_at: string | null;
  must_change_password: number;
  created_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  org_id: string | null;
  wallet_address: string | null;
  wallet_verified: boolean;
  must_change_password: boolean;
}

export interface JwtPayload {
  sub: string;        // user id
  org: string | null; // org id
  role: Role;
  exp: number;
  iat: number;
}

export function toAuthUser(u: UserRow): AuthUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    org_id: u.org_id,
    wallet_address: u.wallet_address,
    wallet_verified: !!u.wallet_verified_at,
    must_change_password: !!u.must_change_password,
  };
}

export function uuid() {
  return crypto.randomUUID();
}

export function nowIso() {
  return new Date().toISOString();
}
