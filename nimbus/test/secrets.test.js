import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectSecretLeak } from "../src/secrets.js";

test("ordinary preferences are not treated as secrets", () => {
  const inspection = inspectSecretLeak("Préfère le thème sombre et le français.");
  assert.equal(inspection.leaked, false);
});

test("detects private key blocks and assignment-style secrets", () => {
  assert.equal(inspectSecretLeak("-----BEGIN PRIVATE KEY-----\nMIIB").leaked, true);
  assert.equal(inspectSecretLeak("api_key=totally-secret-value").leaked, true);
  assert.equal(inspectSecretLeak("Bearer abcdefghijklmnop").leaked, true);
});
