import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const cryptoSource = await readFile(resolve(scriptDir, "../src/crypto.ts"), "utf8");
const match = cryptoSource.match(/export const PBKDF2_ITERATIONS = ([\d_]+);/);

assert.ok(match, "PBKDF2_ITERATIONS must remain an explicit numeric constant");
const iterations = Number(match[1].replaceAll("_", ""));
assert.equal(iterations, 100_000, "Cloudflare Workers production supports at most 100,000 PBKDF2 iterations");

console.log("Cloudflare crypto policy smoke passed");
