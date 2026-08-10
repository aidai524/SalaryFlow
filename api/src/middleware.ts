// CORS + authentication middleware for Hono

import { Hono, type Context, type MiddlewareHandler } from "hono";
import { verifyToken } from "./crypto";
import type { AuthUser, Env, JwtPayload } from "./types";

export const COOKIE_NAME = "sf_token";

export type AppEnv = {
  Bindings: Env;
  Variables: { user?: AuthUser; jwt?: JwtPayload };
};
export type App = Hono<AppEnv>;
export type Ctx = Context<AppEnv>;

const safeOrigin = (env: Env) => env.APP_URL || "http://127.0.0.1:5173";

export const corsMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    const origin = c.req.header("Origin");
    if (origin) {
      const allowed = new Set([safeOrigin(c.env), "http://127.0.0.1:5173", "http://localhost:5173"]);
      if (allowed.has(origin)) {
        c.header("Access-Control-Allow-Origin", origin);
        c.header("Vary", "Origin");
        c.header("Access-Control-Allow-Credentials", "true");
        c.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
        c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
        c.header("Access-Control-Max-Age", "86400");
      }
    }
    if (c.req.method === "OPTIONS") {
      return c.body(null, 204);
    }
    await next();
  };
};

export function getToken(c: Ctx): string | null {
  const cookie = c.req.header("Cookie") || "";
  const m = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (m) return decodeURIComponent(m[1]);
  const auth = c.req.header("Authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const token = getToken(c);
  const payload = token ? await verifyToken(token, c.env) : null;
  if (!payload) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("jwt", payload);
  await next();
};

export async function loadUser(c: Ctx): Promise<AuthUser | null> {
  const jwt = c.get("jwt");
  if (!jwt) return null;
  const row = await c.env.DB.prepare(
    "SELECT id, email, name, role, status, org_id, wallet_address, wallet_verified_at, must_change_password, created_at FROM users WHERE id = ?",
  ).bind(jwt.sub).first<Record<string, unknown>>();
  if (!row || row.status === "disabled") return null;
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    role: row.role as "admin" | "employee",
    org_id: row.org_id ? String(row.org_id) : null,
    wallet_address: row.wallet_address ? String(row.wallet_address) : null,
    wallet_verified: !!row.wallet_verified_at,
    must_change_password: !!row.must_change_password,
  };
}

export function requireRole(...roles: string[]): MiddlewareHandler {
  return async (c, next) => {
    const token = getToken(c);
    const payload = token ? await verifyToken(token, c.env) : null;
    if (!payload) return c.json({ error: "Unauthorized" }, 401);
    c.set("jwt", payload);
    const user = await loadUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    if (!roles.includes(user.role)) return c.json({ error: "Forbidden" }, 403);
    c.set("user", user);
    await next();
  };
}

export function setAuthCookie(c: Ctx, token: string, env: Env) {
  const secure = env.APP_URL.startsWith("https");
  const domain = env.COOKIE_DOMAIN ? `; Domain=${env.COOKIE_DOMAIN}` : "";
  c.header(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}${domain}; Max-Age=604800`,
  );
}

export function clearAuthCookie(c: Ctx, env: Env) {
  const domain = env.COOKIE_DOMAIN ? `; Domain=${env.COOKIE_DOMAIN}` : "";
  c.header("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${domain}`);
}
