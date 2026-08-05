// SalaryFlow API — Cloudflare Worker (Hono)
// Endpoints:
//   /api/auth/*      register / login / logout / me
//   /api/invites/*   invitation management + acceptance
//   /api/org/*       org info + employee directory
//   /api/payroll/*   runs + items
//   /api/payments/*  1Click proxy (quote / generate-intent / submit-intent / status)
//   /api/records/*   chain records + employee self-service

import { Hono } from "hono";
import { corsMiddleware, type AppEnv } from "./middleware";
import { authRoutes } from "./routes/auth";
import { inviteRoutes } from "./routes/invites";
import { orgRoutes } from "./routes/org";
import { payrollRoutes } from "./routes/payroll";
import { paymentRoutes } from "./routes/payments";
import { recordRoutes } from "./routes/records";

const app = new Hono<AppEnv>();
app.use("*", corsMiddleware());

app.get("/health", (c) => c.json({ ok: true, service: "salaryflow-api" }));

app.route("/api/auth", authRoutes);
app.route("/api/invites", inviteRoutes);
app.route("/api/org", orgRoutes);
app.route("/api/payroll", payrollRoutes);
app.route("/api/payments", paymentRoutes);
app.route("/api/records", recordRoutes);

app.notFound((c) => c.json({ error: "Not found" }, 404));

export default app;
