// SalaryFlow API — Cloudflare Worker (Hono)
// Endpoints:
//   /api/auth/*      register / login / logout / me
//   /api/invites/*   invitation management + acceptance
//   /api/org/*       org info + employee directory
//   /api/payroll/*   runs + items
//   /api/payments/*  dry preflight + idempotent 1Click payment attempts
//   /api/records/*   chain records + employee self-service

import { Hono } from "hono";
import { corsMiddleware, type AppEnv } from "./middleware";
import { authRoutes } from "./routes/auth";
import { inviteRoutes } from "./routes/invites";
import { orgRoutes } from "./routes/org";
import { payrollRoutes } from "./routes/payroll";
import { paymentRoutes } from "./routes/payments";
import { recordRoutes } from "./routes/records";
import { reconcileOpenPayments } from "./payment-execution";
import { materializePayrollSchedules } from "./payroll-schedule";
import type { Env } from "./types";

const app = new Hono<AppEnv>();
app.use("*", corsMiddleware());

app.get("/health", (c) => c.json({ ok: true, service: "salaryflow-api" }));

// Never fall back to a public signing key in a deployed Worker. This keeps the
// first deployment closed until the production JWT secret has been installed.
app.use("/api/*", async (c, next) => {
  if (!c.env.JWT_SECRET) {
    return c.json({ error: "Service is not configured", code: "SERVER_NOT_CONFIGURED" }, 503);
  }
  await next();
});

app.route("/api/auth", authRoutes);
app.route("/api/invites", inviteRoutes);
app.route("/api/org", orgRoutes);
app.route("/api/payroll", payrollRoutes);
app.route("/api/payments", paymentRoutes);
app.route("/api/records", recordRoutes);

app.notFound((c) => c.json({ error: "Not found" }, 404));

export default {
  fetch: app.fetch,
  scheduled(_controller, env, ctx) {
    if (!env.JWT_SECRET) return;
    ctx.waitUntil(Promise.all([
      materializePayrollSchedules(env),
      reconcileOpenPayments(env, 1),
    ]));
  },
} satisfies ExportedHandler<Env>;
