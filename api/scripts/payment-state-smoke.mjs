import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { generateKeyPairSync, sign as signBytes } from "node:crypto";
import { quoteHash } from "@defuse-protocol/one-click-sdk-typescript";
import { privateKeyToAccount } from "viem/accounts";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const apiDir = resolve(scriptDir, "..");
const workspaceDir = resolve(apiDir, "..");
const wranglerBin = resolve(workspaceDir, "node_modules/.bin/wrangler");
const persistenceDir = await mkdtemp(join(tmpdir(), "salaryflow-payment-state-smoke-"));
const childEnv = { ...process.env, NO_COLOR: "1", WRANGLER_SEND_METRICS: "false" };

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
  if (result.status !== 0) throw new Error(`D1 migration failed:\n${result.stdout}\n${result.stderr}`);
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

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function listen(server, port) {
  return new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolveListen);
  });
}

function closeServer(server) {
  return new Promise((resolveClose) => server.close(() => resolveClose()));
}

const workerPort = await freePort();
const providerPort = await freePort();
const baseUrl = `http://127.0.0.1:${workerPort}`;
const providerUrl = `http://127.0.0.1:${providerPort}`;
const providerCalls = { tokens: 0, quote: 0, generate: 0, submit: 0, status: 0 };
const statusCallsByDeposit = new Map();
const quoteResponsesByDeposit = new Map();
const base58Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
let expectedPaymentSignature = "";
let tokenMode = "valid";
let quoteMode = "valid";
let statusMode = "valid";
let successfulQuotes = 0;

function encodeBase58(bytes) {
  let numeric = 0n;
  for (const byte of bytes) numeric = numeric * 256n + BigInt(byte);
  let encoded = "";
  while (numeric > 0n) {
    encoded = base58Alphabet[Number(numeric % 58n)] + encoded;
    numeric /= 58n;
  }
  let leadingZeros = 0;
  while (leadingZeros < bytes.length && bytes[leadingZeros] === 0) leadingZeros += 1;
  return "1".repeat(leadingZeros) + encoded;
}

function decodeBase58(value) {
  let numeric = 0n;
  for (const character of value) {
    const digit = base58Alphabet.indexOf(character);
    assert.notEqual(digit, -1, "Provider signature contains an invalid base58 character");
    numeric = numeric * 58n + BigInt(digit);
  }
  const bytes = [];
  while (numeric > 0n) {
    bytes.unshift(Number(numeric & 255n));
    numeric >>= 8n;
  }
  const leadingZeros = value.match(/^1*/)?.[0].length ?? 0;
  return Uint8Array.from([...new Array(leadingZeros).fill(0), ...bytes]);
}

const providerSigningKeys = generateKeyPairSync("ed25519");
const providerPublicKeyDer = providerSigningKeys.publicKey.export({ type: "spki", format: "der" });
const providerPublicKeyRaw = providerPublicKeyDer.subarray(providerPublicKeyDer.length - 32);
assert.equal(providerPublicKeyRaw.length, 32);
const providerPublicKey = `ed25519:${encodeBase58(providerPublicKeyRaw)}`;

function createSignedQuote(body, depositAddress) {
  const amountIn = (BigInt(body.amount) + 10_000n).toString();
  const response = {
    correlationId: `quote-correlation-${providerCalls.quote}`,
    timestamp: new Date().toISOString(),
    signature: "",
    quoteRequest: body,
    quote: {
      amountIn,
      amountInFormatted: amountIn,
      amountInUsd: amountIn,
      minAmountIn: String(body.amount),
      amountOut: String(body.amount),
      amountOutFormatted: String(body.amount),
      amountOutUsd: String(body.amount),
      minAmountOut: String(body.amount),
      depositAddress,
      deadline: body.deadline,
      timeWhenInactive: body.deadline,
      timeEstimate: 1,
    },
  };
  const signature = signBytes(null, Buffer.from(quoteHash(response), "utf8"), providerSigningKeys.privateKey);
  response.signature = `ed25519:${encodeBase58(signature)}`;
  return response;
}

const providerServer = createServer(async (request, response) => {
  const url = new URL(request.url || "/", providerUrl);
  response.setHeader("Content-Type", "application/json");
  try {
    if (request.method === "GET" && url.pathname === "/v0/tokens") {
      providerCalls.tokens += 1;
      assert.equal(request.headers["x-api-key"], undefined);
      response.end(JSON.stringify([
        { assetId: "asset:confidential-usdc", decimals: 6, blockchain: "near", symbol: "USDC" },
        { assetId: "asset:confidential-usdt", decimals: 6, blockchain: "near", symbol: "USDT" },
        { assetId: "asset:base-usdc", decimals: tokenMode === "wrong-decimals" ? 7 : 8, blockchain: "base", symbol: "USDC" },
        { assetId: "asset:base-usdt", decimals: 6, blockchain: "base", symbol: "USDT" },
      ]));
      return;
    }
    assert.equal(request.headers["x-api-key"], "salaryflow-smoke-key");
    if (request.method === "POST" && url.pathname === "/v0/quote") {
      providerCalls.quote += 1;
      const body = await readJson(request);
      assert.ok(["125025000100", "1000000100"].includes(body.amount));
      if (quoteMode === "tampered") {
        const tampered = createSignedQuote(body, "salaryflow-local-deposit-before-tamper");
        tampered.quote.depositAddress = "salaryflow-local-deposit-after-tamper";
        response.end(JSON.stringify(tampered));
        return;
      }
      successfulQuotes += 1;
      const depositAddress = `salaryflow-local-deposit-${successfulQuotes}`;
      const quoteResponse = createSignedQuote(body, depositAddress);
      quoteResponsesByDeposit.set(depositAddress, quoteResponse);
      response.end(JSON.stringify(quoteResponse));
      return;
    }
    if (request.method === "POST" && url.pathname === "/v0/generate-intent") {
      providerCalls.generate += 1;
      const body = await readJson(request);
      response.end(JSON.stringify({
        correlationId: "intent-correlation-1",
        intent: {
          standard: "erc191",
          payload: JSON.stringify({
            signer_id: body.signerId,
            verifying_contract: "intents.near",
            deadline: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            nonce: "c2FsYXJ5Zmxvdy1zbW9rZS1ub25jZQ==",
            simulate_submission_unknown: body.depositAddress.endsWith("-2"),
            intents: [{ intent: "token_diff", diff: { "asset:usdc": "-1250260001" } }],
          }),
        },
      }));
      return;
    }
    if (request.method === "POST" && url.pathname === "/v0/submit-intent") {
      providerCalls.submit += 1;
      const body = await readJson(request);
      assert.equal(body.signedData.standard, "erc191");
      assert.match(body.signedData.signature, /^secp256k1:/);
      const decoded = decodeBase58(body.signedData.signature.slice("secp256k1:".length));
      const expected = Uint8Array.from(expectedPaymentSignature.slice(2).match(/.{2}/g).map((byte) => Number.parseInt(byte, 16)));
      if (expected[64] >= 27) expected[64] -= 27;
      assert.deepEqual(decoded, expected);
      if (JSON.parse(body.signedData.payload).simulate_submission_unknown) {
        response.statusCode = 500;
        response.end(JSON.stringify({ message: "Simulated response loss after provider acceptance" }));
        return;
      }
      response.end(JSON.stringify({ intentHash: "salaryflow-intent-hash-1", correlationId: "submit-correlation-1" }));
      return;
    }
    if (request.method === "GET" && url.pathname === "/v0/status") {
      providerCalls.status += 1;
      const depositAddress = url.searchParams.get("depositAddress");
      assert.match(depositAddress || "", /^salaryflow-local-deposit-[12]$/);
      const depositCalls = (statusCallsByDeposit.get(depositAddress) || 0) + 1;
      statusCallsByDeposit.set(depositAddress, depositCalls);
      const status = depositAddress === "salaryflow-local-deposit-1" && depositCalls <= 2 ? "PROCESSING" : "SUCCESS";
      const storedQuote = quoteResponsesByDeposit.get(depositAddress);
      assert.ok(storedQuote, "Status lookup must reference a quote created by the provider");
      const quoteResponse = JSON.parse(JSON.stringify(storedQuote));
      if (statusMode === "tampered-quote") quoteResponse.quote.depositAddress = "salaryflow-status-tampered-deposit";
      response.end(JSON.stringify({
        correlationId: "status-correlation-1",
        quoteResponse,
        status,
        updatedAt: new Date().toISOString(),
        swapDetails: { intentHashes: [depositAddress === "salaryflow-local-deposit-1" ? "salaryflow-intent-hash-1" : "salaryflow-intent-hash-2"] },
      }));
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ message: "Not found" }));
  } catch (error) {
    response.statusCode = 500;
    response.end(JSON.stringify({ message: error instanceof Error ? error.message : "Mock provider error" }));
  }
});

const workerLogs = { output: "", exited: false };
let worker;

try {
  applyMigrations();
  await listen(providerServer, providerPort);
  const assetMap = JSON.stringify({
    origin: {
      USDC: { assetId: "asset:confidential-usdc", decimals: 6 },
      USDT: { assetId: "asset:confidential-usdt", decimals: 6 },
    },
    destination: {
      Base: {
        USDC: { assetId: "asset:base-usdc", decimals: 8 },
        USDT: { assetId: "asset:base-usdt", decimals: 6 },
      },
    },
  });
  worker = spawn(
    wranglerBin,
    [
      "dev",
      "--local",
      "--ip", "127.0.0.1",
      "--port", String(workerPort),
      "--persist-to", persistenceDir,
      "--log-level", "error",
      "--show-interactive-dev-session=false",
      "--var", "PAYMENTS_MODE:live",
      "--var", "PAYMENTS_EXECUTION_ACK:local-test",
      "--var", `INTENTS_API_URL:${providerUrl}`,
      "--var", "INTENTS_API_KEY:salaryflow-smoke-key",
      "--var", `INTENTS_ASSET_MAP:${assetMap}`,
      "--var", `INTENTS_QUOTE_PUBLIC_KEY:${providerPublicKey}`,
      "--var", "APP_URL:http://127.0.0.1:5173",
      "--var", `API_URL:${baseUrl}`,
      "--var", "COOKIE_DOMAIN:",
      "--var", "MOCK_EMAIL:true",
      "--var", "JWT_SECRET:salaryflow-payment-state-smoke-secret",
    ],
    { cwd: apiDir, env: childEnv, stdio: ["ignore", "pipe", "pipe"] },
  );
  worker.stdout.on("data", (chunk) => { workerLogs.output += chunk.toString(); });
  worker.stderr.on("data", (chunk) => { workerLogs.output += chunk.toString(); });
  worker.once("exit", () => { workerLogs.exited = true; });
  await waitForWorker(baseUrl, workerLogs);

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const adminEmail = `payment-admin-${suffix}@example.com`;
  const employeeEmail = `payment-employee-${suffix}@example.com`;
  const adminAccount = privateKeyToAccount("0x0000000000000000000000000000000000000000000000000000000000000011");
  const employeeAccount = privateKeyToAccount("0x0000000000000000000000000000000000000000000000000000000000000012");
  const wrongAccount = privateKeyToAccount("0x0000000000000000000000000000000000000000000000000000000000000013");

  const registered = await apiRequest(baseUrl, "/api/auth/register", {
    method: "POST",
    body: { email: adminEmail, password: "PaymentAdmin123!", name: "Payment Admin", orgName: "Payment State Labs" },
    expected: 201,
  });
  const adminCookie = registered.cookie;
  const invite = await apiRequest(baseUrl, "/api/invites", {
    method: "POST",
    cookie: adminCookie,
    body: { email: employeeEmail, role: "employee" },
    expected: 201,
  });
  const inviteToken = new URL(invite.data.inviteUrl).pathname.split("/").pop();
  const accepted = await apiRequest(baseUrl, "/api/invites/accept", {
    method: "POST",
    body: { token: inviteToken, email: employeeEmail, name: "Payment Employee", password: "PaymentEmployee123!" },
  });
  const employeeCookie = accepted.cookie;

  await apiRequest(baseUrl, "/api/records/me/payout", {
    method: "PUT",
    cookie: employeeCookie,
    body: { token: "USDC", network: "Base", endpoint: employeeAccount.address },
  });
  const payoutChallenge = await apiRequest(baseUrl, "/api/records/me/payout/challenge", {
    method: "POST",
    cookie: employeeCookie,
    body: { token: "USDC", network: "Base", endpoint: employeeAccount.address },
  });
  const payoutSignature = await employeeAccount.signMessage({ message: payoutChallenge.data.message });
  await apiRequest(baseUrl, "/api/records/me/payout/verify", {
    method: "POST",
    cookie: employeeCookie,
    body: { challengeId: payoutChallenge.data.challengeId, signature: payoutSignature },
  });

  const walletChallenge = await apiRequest(baseUrl, "/api/records/wallet/challenge", {
    method: "POST",
    cookie: adminCookie,
    body: { address: adminAccount.address },
  });
  const wrongWalletSignature = await wrongAccount.signMessage({ message: walletChallenge.data.message });
  await apiRequest(baseUrl, "/api/records/wallet/verify", {
    method: "POST",
    cookie: adminCookie,
    body: { challengeId: walletChallenge.data.challengeId, signature: wrongWalletSignature },
    expected: 400,
  });
  const walletSignature = await adminAccount.signMessage({ message: walletChallenge.data.message });
  await apiRequest(baseUrl, "/api/records/wallet/verify", {
    method: "POST",
    cookie: adminCookie,
    body: { challengeId: walletChallenge.data.challengeId, signature: walletSignature },
  });
  const adminMe = await apiRequest(baseUrl, "/api/auth/me", { cookie: adminCookie });
  assert.equal(adminMe.data.user.wallet_address.toLowerCase(), adminAccount.address.toLowerCase());
  assert.equal(adminMe.data.user.wallet_verified, true);

  const employees = await apiRequest(baseUrl, "/api/org/employees", { cookie: adminCookie });
  const employeeId = employees.data.employees[0].id;
  const createdRun = await apiRequest(baseUrl, "/api/payroll", {
    method: "POST",
    cookie: adminCookie,
    body: { label: "Payment state smoke", payDate: "2026-09-30" },
    expected: 201,
  });
  const runId = createdRun.data.run.id;
  const item = await apiRequest(baseUrl, `/api/payroll/${runId}/items`, {
    method: "POST",
    cookie: adminCookie,
    body: { employeeId, amount: "1250.250001" },
    expected: 201,
  });
  const itemId = item.data.item.id;
  await apiRequest(baseUrl, "/api/payments/quote", {
    method: "POST",
    cookie: adminCookie,
    body: { runId, dry: true },
  });

  tokenMode = "wrong-decimals";
  const mismatchedAssetMap = await apiRequest(baseUrl, `/api/payments/items/${itemId}/quote`, {
    method: "POST",
    cookie: adminCookie,
    body: { idempotencyKey: `payment-asset-mismatch:${suffix}` },
    expected: 503,
  });
  assert.equal(mismatchedAssetMap.data.code, "ASSET_MAP_PROVIDER_MISMATCH");
  assert.match(mismatchedAssetMap.data.error, /decimals mismatch/);
  assert.equal(providerCalls.tokens, 1);
  assert.equal(providerCalls.quote, 0);
  tokenMode = "valid";

  quoteMode = "tampered";
  const tamperedQuote = await apiRequest(baseUrl, `/api/payments/items/${itemId}/quote`, {
    method: "POST",
    cookie: adminCookie,
    body: { idempotencyKey: `payment-tampered-quote:${suffix}` },
    expected: 502,
  });
  assert.equal(tamperedQuote.data.code, "PAYMENT_PROVIDER_ERROR");
  assert.match(tamperedQuote.data.detail, /signature verification failed/);
  assert.equal(providerCalls.tokens, 2);
  assert.equal(providerCalls.quote, 1);
  quoteMode = "valid";

  const idempotencyKey = `payment-state-smoke:${suffix}`;
  const quoted = await apiRequest(baseUrl, `/api/payments/items/${itemId}/quote`, {
    method: "POST",
    cookie: adminCookie,
    body: { idempotencyKey },
    expected: 201,
  });
  assert.equal(quoted.data.attempt.state, "quoted");
  assert.match(quoted.data.attempt.quote_hash, /^[1-9A-HJ-NP-Za-km-z]{40,50}$/);
  assert.notEqual(quoted.data.attempt.quote_hash, JSON.parse(quoted.data.attempt.quote_response).signature);
  const attemptId = quoted.data.attempt.id;
  const reusedQuote = await apiRequest(baseUrl, `/api/payments/items/${itemId}/quote`, {
    method: "POST",
    cookie: adminCookie,
    body: { idempotencyKey },
  });
  assert.equal(reusedQuote.data.reused, true);
  assert.equal(providerCalls.tokens, 3);
  assert.equal(providerCalls.quote, 2);

  const replacementChallenge = await apiRequest(baseUrl, "/api/records/wallet/challenge", {
    method: "POST",
    cookie: adminCookie,
    body: { address: wrongAccount.address },
  });
  const replacementSignature = await wrongAccount.signMessage({ message: replacementChallenge.data.message });
  const blockedReplacement = await apiRequest(baseUrl, "/api/records/wallet/verify", {
    method: "POST",
    cookie: adminCookie,
    body: { challengeId: replacementChallenge.data.challengeId, signature: replacementSignature },
    expected: 409,
  });
  assert.equal(blockedReplacement.data.code, "ACTIVE_PAYMENT_ATTEMPTS");
  const blockedRemoval = await apiRequest(baseUrl, "/api/records/wallet", {
    method: "DELETE",
    cookie: adminCookie,
    expected: 409,
  });
  assert.equal(blockedRemoval.data.code, "ACTIVE_PAYMENT_ATTEMPTS");

  const generated = await apiRequest(baseUrl, `/api/payments/attempts/${attemptId}/intent`, {
    method: "POST",
    cookie: adminCookie,
  });
  assert.equal(generated.data.attempt.state, "awaiting_signature");
  const reusedIntent = await apiRequest(baseUrl, `/api/payments/attempts/${attemptId}/intent`, {
    method: "POST",
    cookie: adminCookie,
  });
  assert.equal(reusedIntent.data.reused, true);
  assert.equal(providerCalls.generate, 1);

  const wrongPaymentSignature = await wrongAccount.signMessage({ message: generated.data.intent.payload });
  await apiRequest(baseUrl, `/api/payments/attempts/${attemptId}/submit`, {
    method: "POST",
    cookie: adminCookie,
    body: { signature: wrongPaymentSignature },
    expected: 400,
  });
  const paymentSignature = await adminAccount.signMessage({ message: generated.data.intent.payload });
  expectedPaymentSignature = paymentSignature;
  const submitted = await apiRequest(baseUrl, `/api/payments/attempts/${attemptId}/submit`, {
    method: "POST",
    cookie: adminCookie,
    body: { signature: paymentSignature },
  });
  assert.equal(submitted.data.attempt.state, "submitted");
  assert.equal(submitted.data.attempt.intent_hash, "salaryflow-intent-hash-1");
  const reusedSubmit = await apiRequest(baseUrl, `/api/payments/attempts/${attemptId}/submit`, {
    method: "POST",
    cookie: adminCookie,
    body: { signature: paymentSignature },
  });
  assert.equal(reusedSubmit.data.reused, true);
  assert.equal(providerCalls.submit, 1);

  statusMode = "tampered-quote";
  const rejectedStatus = await apiRequest(baseUrl, `/api/payments/attempts/${attemptId}/reconcile`, {
    method: "POST",
    cookie: adminCookie,
  });
  assert.equal(rejectedStatus.data.attempt.state, "submitted");
  assert.equal(rejectedStatus.data.attempt.reconcile_failures, 1);
  assert.match(rejectedStatus.data.attempt.last_error, /signature verification failed/);
  statusMode = "valid";

  const processing = await apiRequest(baseUrl, `/api/payments/attempts/${attemptId}/reconcile`, {
    method: "POST",
    cookie: adminCookie,
  });
  assert.equal(processing.data.attempt.state, "processing");
  const confirmed = await apiRequest(baseUrl, `/api/payments/attempts/${attemptId}/reconcile`, {
    method: "POST",
    cookie: adminCookie,
  });
  assert.equal(confirmed.data.attempt.state, "confirmed");
  assert.equal(providerCalls.status, 3);

  const run = await apiRequest(baseUrl, `/api/payroll/${runId}`, { cookie: adminCookie });
  assert.equal(run.data.run.status, "paid");
  assert.equal(run.data.items[0].status, "paid");
  assert.equal(run.data.items[0].payment_state, "confirmed");
  assert.equal(run.data.items[0].provider_status, "SUCCESS");
  await apiRequest(baseUrl, `/api/payroll/${runId}`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { status: "paid" },
    expected: 400,
  });
  const records = await apiRequest(baseUrl, "/api/records", { cookie: adminCookie });
  assert.equal(records.data.records.length, 1);
  assert.equal(records.data.records[0].status, "confirmed");
  assert.equal(records.data.records[0].provider_status, "SUCCESS");
  const attempts = await apiRequest(baseUrl, `/api/payments/runs/${runId}/attempts`, { cookie: adminCookie });
  assert.equal(attempts.data.attempts.length, 2);
  assert.deepEqual(attempts.data.attempts.map((attempt) => attempt.state).sort(), ["confirmed", "failed"]);
  assert.match(attempts.data.attempts.find((attempt) => attempt.state === "failed").last_error, /signature verification failed/);

  const unknownRun = await apiRequest(baseUrl, "/api/payroll", {
    method: "POST",
    cookie: adminCookie,
    body: { label: "Unknown submission smoke", payDate: "2026-10-31" },
    expected: 201,
  });
  const unknownRunId = unknownRun.data.run.id;
  const unknownItem = await apiRequest(baseUrl, `/api/payroll/${unknownRunId}/items`, {
    method: "POST",
    cookie: adminCookie,
    body: { employeeId, amount: "10.000001" },
    expected: 201,
  });
  const unknownQuoted = await apiRequest(baseUrl, `/api/payments/items/${unknownItem.data.item.id}/quote`, {
    method: "POST",
    cookie: adminCookie,
    body: { idempotencyKey: `payment-unknown-smoke:${suffix}` },
    expected: 201,
  });
  const unknownAttemptId = unknownQuoted.data.attempt.id;
  const unknownIntent = await apiRequest(baseUrl, `/api/payments/attempts/${unknownAttemptId}/intent`, {
    method: "POST",
    cookie: adminCookie,
  });
  const unknownSignature = await adminAccount.signMessage({ message: unknownIntent.data.intent.payload });
  expectedPaymentSignature = unknownSignature;
  const unknownSubmit = await apiRequest(baseUrl, `/api/payments/attempts/${unknownAttemptId}/submit`, {
    method: "POST",
    cookie: adminCookie,
    body: { signature: unknownSignature },
    expected: 202,
  });
  assert.equal(unknownSubmit.data.outcome, "unknown");
  assert.equal(unknownSubmit.data.attempt.state, "processing");
  const unknownSubmitReplay = await apiRequest(baseUrl, `/api/payments/attempts/${unknownAttemptId}/submit`, {
    method: "POST",
    cookie: adminCookie,
    body: { signature: unknownSignature },
  });
  assert.equal(unknownSubmitReplay.data.reused, true);
  assert.equal(providerCalls.submit, 2);
  const unknownConfirmed = await apiRequest(baseUrl, `/api/payments/attempts/${unknownAttemptId}/reconcile`, {
    method: "POST",
    cookie: adminCookie,
  });
  assert.equal(unknownConfirmed.data.attempt.state, "confirmed");
  assert.equal(unknownConfirmed.data.attempt.intent_hash, "salaryflow-intent-hash-2");
  const unknownRunDetail = await apiRequest(baseUrl, `/api/payroll/${unknownRunId}`, { cookie: adminCookie });
  assert.equal(unknownRunDetail.data.run.status, "paid");
  assert.equal(unknownRunDetail.data.items[0].status, "paid");
  assert.equal(providerCalls.status, 4);
  assert.equal(providerCalls.tokens, 4);
  assert.equal(providerCalls.quote, 3);

  console.log("SalaryFlow payment-state smoke test passed: asset metadata, quote/status signatures, wallet proof, idempotency, signed submit, unknown outcomes, and reconciliation.");
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
  if (providerServer.listening) await closeServer(providerServer);
  await rm(persistenceDir, { recursive: true, force: true });
}
