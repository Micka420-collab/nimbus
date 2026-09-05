import assert from "node:assert/strict";
import { test } from "node:test";
import { assertNoSecret, inspectSecretLeak } from "../src/secrets.js";
import { createMemory } from "../src/memory.js";
import { tempState } from "./helpers.js";

test("ordinary preferences are not treated as secrets", () => {
  const inspection = inspectSecretLeak("Préfère le thème sombre et le français.");
  assert.equal(inspection.leaked, false);
});

test("detects private key blocks and assignment-style secrets", () => {
  assert.equal(inspectSecretLeak("-----BEGIN PRIVATE KEY-----\nMIIB").leaked, true);
  assert.equal(inspectSecretLeak("api_key=totally-secret-value").leaked, true);
  assert.equal(inspectSecretLeak("Bearer abcdefghijklmnop").leaked, true);
  assert.equal(inspectSecretLeak("password: hunter2").leaked, true);
});

test("password manager prose is not a secret; --force is the loud escape hatch", () => {
  const prose = "mon gestionnaire password: Bitwarden";
  assert.equal(inspectSecretLeak(prose).leaked, false);
  const memory = createMemory(tempState("nimbus-secret-"));
  const learned = memory.learn({ key: "gestionnaire", value: prose });
  assert.equal(learned.ok, true);
  assert.equal(memory.list().entries[0].value, prose);

  const secret = "password: hunter2";
  const refused = memory.learn({ key: "mdp", value: secret });
  assert.equal(refused.ok, false);
  assert.equal(refused.code, "secret_refused");
  assert.match(refused.message, /--force/);
  const forced = assertNoSecret(secret, "memory", { force: true });
  assert.equal(forced.ok, true);
  assert.equal(forced.forced, true);
  assert.match(forced.warning, /ATTENTION/);
  const stored = memory.learn({ key: "mdp", value: secret, force: true });
  assert.equal(stored.ok, true);
  assert.equal(stored.forced, true);

  const proseVault = "password: mon-coffre-perso";
  assert.equal(inspectSecretLeak(proseVault).leaked, false);
  const vault = memory.learn({ key: "coffre", value: proseVault });
  assert.equal(vault.ok, true);
});
