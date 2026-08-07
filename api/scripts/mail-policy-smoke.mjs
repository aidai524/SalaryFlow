import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const mailSource = await readFile(resolve(scriptDir, "../src/mail.ts"), "utf8");

assert.match(
  mailSource,
  /const mock = env\.MOCK_EMAIL === "true";/,
  "Mock email must require an explicit MOCK_EMAIL=true setting",
);
assert.doesNotMatch(
  mailSource,
  /MOCK_EMAIL === "true"\s*\|\|\s*!apiKey/,
  "A missing provider key must not silently enable mock email",
);
assert.match(
  mailSource,
  /if \(!apiKey\) \{\s*return \{ ok: false, error: "Email delivery is not configured" \};\s*\}/,
  "Production must report a missing Resend key as a configuration failure",
);

console.log("SalaryFlow email policy smoke passed");
