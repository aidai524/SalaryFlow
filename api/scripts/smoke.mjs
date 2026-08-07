import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { privateKeyToAccount } from "viem/accounts";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const apiDir = resolve(scriptDir, "..");
const workspaceDir = resolve(apiDir, "..");
const wranglerBin = resolve(workspaceDir, "node_modules/.bin/wrangler");
const persistenceDir = await mkdtemp(join(tmpdir(), "salaryflow-api-smoke-"));
const childEnv = {
  ...process.env,
  NO_COLOR: "1",
  WRANGLER_SEND_METRICS: "false",
};

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolvePort(port));
    });
  });
}

function applyMigrations() {
  const result = spawnSync(
    wranglerBin,
    ["d1", "migrations", "apply", "salaryflow", "--local", "--persist-to", persistenceDir],
    { cwd: apiDir, env: childEnv, encoding: "utf8", input: "y\n" },
  );
  if (result.status !== 0) {
    throw new Error(`D1 migration failed:\n${result.stdout}\n${result.stderr}`);
  }
}

async function waitForWorker(baseUrl, logs) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (logs.exited) throw new Error(`Worker exited before becoming ready:\n${logs.output}`);
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // Worker is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`Worker did not become ready:\n${logs.output}`);
}

function cookieFrom(response) {
  return response.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
}

async function apiRequest(baseUrl, path, { method = "GET", body, cookie, expected = 200 } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  assert.equal(response.status, expected, `${method} ${path}: ${text}`);
  return { data, cookie: cookieFrom(response) };
}

const port = await freePort();
const baseUrl = `http://127.0.0.1:${port}`;
const workerLogs = { output: "", exited: false };
let worker;

try {
  applyMigrations();
  worker = spawn(
    wranglerBin,
    [
      "dev",
      "--local",
      "--ip", "127.0.0.1",
      "--port", String(port),
      "--persist-to", persistenceDir,
      "--log-level", "error",
      "--show-interactive-dev-session=false",
      "--test-scheduled",
      // Isolate the test env: never send real emails or hit live payment rails.
      "--var", "MOCK_EMAIL:true",
      "--var", "PAYMENTS_MODE:dry-run",
      "--var", "JWT_SECRET:smoke-test-secret",
    ],
    { cwd: apiDir, env: childEnv, stdio: ["ignore", "pipe", "pipe"] },
  );
  worker.stdout.on("data", (chunk) => { workerLogs.output += chunk.toString(); });
  worker.stderr.on("data", (chunk) => { workerLogs.output += chunk.toString(); });
  worker.once("exit", () => { workerLogs.exited = true; });
  await waitForWorker(baseUrl, workerLogs);

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const adminEmail = `admin-${suffix}@example.com`;
  const employeeEmail = `employee-${suffix}@example.com`;
  const otherAdminEmail = `other-${suffix}@example.com`;

  const registered = await apiRequest(baseUrl, "/api/auth/register", {
    method: "POST",
    body: { email: adminEmail, password: "BaselinePass123!", name: "Smoke Admin", orgName: "Smoke Labs" },
    expected: 201,
  });
  assert.ok(registered.cookie.startsWith("sf_token="));
  const adminCookie = registered.cookie;
  const directWalletBind = await apiRequest(baseUrl, "/api/records/wallet", {
    method: "PUT",
    cookie: adminCookie,
    body: { address: "0x0000000000000000000000000000000000000001" },
    expected: 409,
  });
  assert.equal(directWalletBind.data.code, "WALLET_SIGNATURE_REQUIRED");

  const invited = await apiRequest(baseUrl, "/api/invites", {
    method: "POST",
    cookie: adminCookie,
    body: { email: employeeEmail, role: "employee" },
    expected: 201,
  });
  const inviteUrl = invited.data.inviteUrl;
  assert.ok(inviteUrl);
  assert.equal(invited.data.mail.ok, true);
  assert.equal(invited.data.mail.mock, true);
  const originalInviteToken = new URL(inviteUrl).pathname.split("/").pop();

  const resent = await apiRequest(baseUrl, `/api/invites/${invited.data.invitation.id}/resend`, {
    method: "POST",
    cookie: adminCookie,
  });
  assert.equal(resent.data.mail.mock, true);
  assert.ok(resent.data.inviteUrl);
  const inviteToken = new URL(resent.data.inviteUrl).pathname.split("/").pop();
  assert.notEqual(inviteToken, originalInviteToken);
  await apiRequest(baseUrl, `/api/invites/resolve/${originalInviteToken}`, { expected: 404 });

  const resolved = await apiRequest(baseUrl, `/api/invites/resolve/${inviteToken}`);
  assert.equal(resolved.data.invitation.accountExists, false);
  assert.equal(resolved.data.invitation.orgName, "Smoke Labs");

  const accepted = await apiRequest(baseUrl, "/api/invites/accept", {
    method: "POST",
    body: {
      token: inviteToken,
      email: employeeEmail,
      name: "Smoke Employee",
      password: "EmployeePass123!",
    },
  });
  assert.ok(accepted.cookie.startsWith("sf_token="));
  const employeeCookie = accepted.cookie;

  const employeeMe = await apiRequest(baseUrl, "/api/auth/me", { cookie: employeeCookie });
  assert.equal(employeeMe.data.user.email, employeeEmail);
  assert.equal(employeeMe.data.user.role, "employee");

  const payout = await apiRequest(baseUrl, "/api/records/me/payout", { cookie: employeeCookie });
  assert.equal(payout.data.payout.name, "Smoke Employee");

  const directory = await apiRequest(baseUrl, "/api/org/employees", { cookie: adminCookie });
  assert.equal(directory.data.employees.length, 1);
  assert.equal(directory.data.employees[0].email, employeeEmail);
  assert.equal(directory.data.employees[0].user_id, employeeMe.data.user.id);
  const employeeId = directory.data.employees[0].id;

  const importRun = await apiRequest(baseUrl, "/api/payroll", {
    method: "POST",
    cookie: adminCookie,
    body: { label: "CSV import", payDate: "2026-08-15", cadence: "manual" },
    expected: 201,
  });
  const invalidImport = await apiRequest(baseUrl, `/api/payroll/${importRun.data.run.id}/items/import`, {
    method: "POST",
    cookie: adminCookie,
    body: { rows: [
      { employeeEmail, employeeName: "Smoke Employee", amount: "99.50", token: "USDC", network: "Base" },
      { employeeEmail: "missing@example.com", employeeName: "Missing", amount: "20", token: "USDC", network: "Base" },
    ] },
    expected: 400,
  });
  assert.equal(invalidImport.data.code, "PAYROLL_IMPORT_INVALID");
  const emptyAfterInvalidImport = await apiRequest(baseUrl, `/api/payroll/${importRun.data.run.id}`, { cookie: adminCookie });
  assert.equal(emptyAfterInvalidImport.data.items.length, 0, "CSV import must be atomic after validation failure");
  const imported = await apiRequest(baseUrl, `/api/payroll/${importRun.data.run.id}/items/import`, {
    method: "POST",
    cookie: adminCookie,
    body: { rows: [
      { employeeEmail, employeeName: "Smoke Employee", amount: "99.50", token: "USDC", network: "Base" },
      { employeeEmail: "", employeeName: "Manual contractor", amount: "20", token: "USDT", network: "Arbitrum" },
    ] },
    expected: 201,
  });
  assert.deepEqual(
    { imported: imported.data.importedCount, linked: imported.data.linkedCount, manual: imported.data.manualCount },
    { imported: 2, linked: 1, manual: 1 },
  );
  const manualDraftPreflight = await apiRequest(baseUrl, "/api/payments/quote", {
    method: "POST",
    cookie: adminCookie,
    body: { runId: importRun.data.run.id, dry: true },
    expected: 422,
  });
  assert.ok(manualDraftPreflight.data.issues.some((issue) => issue.code === "UNLINKED_EMPLOYEE"));

  const lifecycleRun = await apiRequest(baseUrl, "/api/payroll", {
    method: "POST",
    cookie: adminCookie,
    body: { label: "Editable payroll", payDate: "2026-09-01", cadence: "manual" },
    expected: 201,
  });
  const lifecycleItem = await apiRequest(baseUrl, `/api/payroll/${lifecycleRun.data.run.id}/items`, {
    method: "POST",
    cookie: adminCookie,
    body: { employeeId, amount: "10", token: "USDC", network: "Base" },
    expected: 201,
  });
  const editedItem = await apiRequest(baseUrl, `/api/payroll/${lifecycleRun.data.run.id}/items/${lifecycleItem.data.item.id}`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { amount: "12.345678" },
  });
  assert.equal(editedItem.data.item.amount_minor, 12_345_678);
  await apiRequest(baseUrl, `/api/payroll/${lifecycleRun.data.run.id}/items/${lifecycleItem.data.item.id}`, {
    method: "DELETE",
    cookie: adminCookie,
  });
  const afterRemoval = await apiRequest(baseUrl, `/api/payroll/${lifecycleRun.data.run.id}`, { cookie: adminCookie });
  assert.equal(afterRemoval.data.items.length, 0, "removed draft payments should leave the active payment list");
  await apiRequest(baseUrl, `/api/payroll/${lifecycleRun.data.run.id}/items`, {
    method: "POST",
    cookie: adminCookie,
    body: { employeeId, amount: "15" },
    expected: 201,
  });
  const editedRun = await apiRequest(baseUrl, `/api/payroll/${lifecycleRun.data.run.id}`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { label: "Edited payroll", payDate: "2026-09-02" },
  });
  assert.equal(editedRun.data.run.label, "Edited payroll");
  assert.equal(editedRun.data.run.pay_date, "2026-09-02");
  await apiRequest(baseUrl, `/api/payroll/${lifecycleRun.data.run.id}`, { method: "DELETE", cookie: adminCookie });
  await apiRequest(baseUrl, `/api/payroll/${lifecycleRun.data.run.id}`, { cookie: adminCookie, expected: 404 });
  const runsAfterArchive = await apiRequest(baseUrl, "/api/payroll", { cookie: adminCookie });
  assert.ok(!runsAfterArchive.data.runs.some((run) => run.id === lifecycleRun.data.run.id), "archived runs should leave the active run list");

  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const recurringRun = await apiRequest(baseUrl, "/api/payroll", {
    method: "POST",
    cookie: adminCookie,
    body: { label: "Weekly payroll", payDate: sevenDaysAgo, cadence: "weekly" },
    expected: 201,
  });
  await apiRequest(baseUrl, `/api/payroll/${recurringRun.data.run.id}/items`, {
    method: "POST",
    cookie: adminCookie,
    body: { employeeId, amount: "500", token: "USDT", network: "Ethereum" },
    expected: 201,
  });
  const schedules = await apiRequest(baseUrl, "/api/payroll/schedules", { cookie: adminCookie });
  assert.equal(schedules.data.schedules.length, 1);
  assert.equal(schedules.data.schedules[0].cadence, "weekly");
  assert.equal(schedules.data.schedules[0].next_pay_date, today);
  const scheduledResponse = await fetch(`${baseUrl}/__scheduled?cron=*+*+*+*+*`);
  assert.equal(scheduledResponse.status, 200, await scheduledResponse.text());
  const recurringRuns = await apiRequest(baseUrl, "/api/payroll", { cookie: adminCookie });
  const generated = recurringRuns.data.runs.find((run) => run.schedule_id === recurringRun.data.run.schedule_id && run.pay_date === today);
  assert.ok(generated, "scheduled event should materialize the due draft run");
  assert.equal(generated.status, "draft");
  assert.equal(generated.source, "schedule");
  const generatedDetail = await apiRequest(baseUrl, `/api/payroll/${generated.id}`, { cookie: adminCookie });
  assert.equal(generatedDetail.data.items.length, 1, "scheduled draft should copy the latest payment list");
  const paused = await apiRequest(baseUrl, `/api/payroll/schedules/${schedules.data.schedules[0].id}`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { active: false },
  });
  assert.equal(paused.data.schedule.active, false);
  const resumed = await apiRequest(baseUrl, `/api/payroll/schedules/${schedules.data.schedules[0].id}`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { active: true },
  });
  assert.equal(resumed.data.schedule.active, true);
  const editedSchedule = await apiRequest(baseUrl, `/api/payroll/schedules/${schedules.data.schedules[0].id}`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { name: "Biweekly payroll", cadence: "biweekly", nextPayDate: "2026-09-11" },
  });
  assert.equal(editedSchedule.data.schedule.name, "Biweekly payroll");
  assert.equal(editedSchedule.data.schedule.cadence, "biweekly");
  assert.equal(editedSchedule.data.schedule.next_pay_date, "2026-09-11");
  await apiRequest(baseUrl, `/api/payroll/schedules/${schedules.data.schedules[0].id}`, { method: "DELETE", cookie: adminCookie });
  const schedulesAfterArchive = await apiRequest(baseUrl, "/api/payroll/schedules", { cookie: adminCookie });
  assert.equal(schedulesAfterArchive.data.schedules.length, 0, "archived schedules should leave the active schedule list");
  const runsAfterScheduleArchive = await apiRequest(baseUrl, "/api/payroll", { cookie: adminCookie });
  assert.ok(runsAfterScheduleArchive.data.runs.some((run) => run.id === generated.id), "archiving a schedule must retain historical runs");

  const blockedReadinessOverride = await apiRequest(baseUrl, `/api/org/employees/${employeeId}`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { status: "ready" },
    expected: 400,
  });
  assert.match(blockedReadinessOverride.data.error, /signature verification/i);

  await apiRequest(baseUrl, `/api/invites/resolve/${inviteToken}`, { expected: 410 });
  await apiRequest(baseUrl, `/api/invites/${invited.data.invitation.id}/resend`, {
    method: "POST",
    cookie: adminCookie,
    expected: 409,
  });

  const otherAdmin = await apiRequest(baseUrl, "/api/auth/register", {
    method: "POST",
    body: { email: otherAdminEmail, password: "OtherAdminPass123!", name: "Other Admin", orgName: "Other Labs" },
    expected: 201,
  });
  assert.ok(otherAdmin.cookie);
  const crossOrg = await apiRequest(baseUrl, "/api/invites", {
    method: "POST",
    cookie: adminCookie,
    body: { email: otherAdminEmail, role: "employee" },
    expected: 409,
  });
  assert.match(crossOrg.data.error, /another organization/i);

  const createdRun = await apiRequest(baseUrl, "/api/payroll", {
    method: "POST",
    cookie: adminCookie,
    body: { label: "Smoke payroll", payDate: "2026-08-31" },
    expected: 201,
  });
  const runId = createdRun.data.run.id;
  const addedItem = await apiRequest(baseUrl, `/api/payroll/${runId}/items`, {
    method: "POST",
    cookie: adminCookie,
    body: { employeeId, amount: "1250.250001", token: "USDC", network: "Base" },
    expected: 201,
  });
  assert.equal(addedItem.data.item.amount_minor, 1_250_250_001);
  const blockedStatefulQuote = await apiRequest(baseUrl, `/api/payments/items/${addedItem.data.item.id}/quote`, {
    method: "POST",
    cookie: adminCookie,
    body: { idempotencyKey: `dry-run-blocked:${suffix}` },
    expected: 409,
  });
  assert.equal(blockedStatefulQuote.data.code, "LIVE_PAYMENTS_DISABLED");
  await apiRequest(baseUrl, `/api/payroll/${runId}/items`, {
    method: "POST",
    cookie: adminCookie,
    body: { employeeId, amount: "1.0000001", token: "USDC", network: "Base" },
    expected: 400,
  });
  const runs = await apiRequest(baseUrl, "/api/payroll", { cookie: adminCookie });
  assert.equal(runs.data.runs[0].usdcMinor, 1_250_250_001);

  await apiRequest(baseUrl, "/api/payments/quote", {
    method: "POST",
    cookie: adminCookie,
    body: { runId, dry: false },
    expected: 409,
  });
  const pendingPreflight = await apiRequest(baseUrl, "/api/payments/quote", {
    method: "POST",
    cookie: adminCookie,
    body: { runId, dry: true },
    expected: 422,
  });
  assert.equal(pendingPreflight.data.code, "DRY_RUN_VALIDATION_FAILED");

  const payoutAccount = privateKeyToAccount("0x0000000000000000000000000000000000000000000000000000000000000001");
  await apiRequest(baseUrl, "/api/records/me/payout", {
    method: "PUT",
    cookie: employeeCookie,
    body: { token: "USDC", network: "Base", endpoint: payoutAccount.address },
  });
  const challenge = await apiRequest(baseUrl, "/api/records/me/payout/challenge", {
    method: "POST",
    cookie: employeeCookie,
    body: { token: "USDC", network: "Base", endpoint: payoutAccount.address },
  });
  const wrongPayoutAccount = privateKeyToAccount("0x0000000000000000000000000000000000000000000000000000000000000002");
  const wrongSignature = await wrongPayoutAccount.signMessage({ message: challenge.data.message });
  await apiRequest(baseUrl, "/api/records/me/payout/verify", {
    method: "POST",
    cookie: employeeCookie,
    body: { challengeId: challenge.data.challengeId, signature: wrongSignature },
    expected: 400,
  });
  const signature = await payoutAccount.signMessage({ message: challenge.data.message });
  const verified = await apiRequest(baseUrl, "/api/records/me/payout/verify", {
    method: "POST",
    cookie: employeeCookie,
    body: { challengeId: challenge.data.challengeId, signature },
  });
  assert.equal(verified.data.payout.status, "ready");
  assert.ok(verified.data.payout.payout_verified_at);
  await apiRequest(baseUrl, "/api/records/me/payout/verify", {
    method: "POST",
    cookie: employeeCookie,
    body: { challengeId: challenge.data.challengeId, signature },
    expected: 409,
  });
  const validPreflight = await apiRequest(baseUrl, "/api/payments/quote", {
    method: "POST",
    cookie: adminCookie,
    body: { runId, dry: true },
  });
  assert.equal(validPreflight.data.executionAllowed, false);
  assert.equal(validPreflight.data.validatedItemCount, 1);
  assert.equal(validPreflight.data.totals.usdcMinor, 1_250_250_001);

  for (const path of ["/api/payments/generate-intent", "/api/payments/submit-intent", "/api/payments/status"]) {
    const blocked = await apiRequest(baseUrl, path, {
      method: "POST",
      cookie: adminCookie,
      body: {},
      expected: 409,
    });
    assert.equal(blocked.data.code, "LIVE_PAYMENTS_DISABLED");
  }

  const records = await apiRequest(baseUrl, "/api/records", { cookie: adminCookie });
  assert.deepEqual(records.data.records, []);

  console.log("SalaryFlow API smoke test passed: invite session, payroll CSV import, recurring draft schedules, payout signature, and payment dry-run gate.");
} finally {
  if (worker && !worker.killed) {
    worker.kill("SIGTERM");
    await new Promise((resolveWait) => {
      const timeout = setTimeout(resolveWait, 2_000);
      worker.once("exit", () => {
        clearTimeout(timeout);
        resolveWait();
      });
    });
  }
  await rm(persistenceDir, { recursive: true, force: true });
}
