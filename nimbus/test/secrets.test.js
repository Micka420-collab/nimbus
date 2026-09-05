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

test("credential assignment is refused regardless of value; prose without assignment is allowed", () => {
  const memory = createMemory(tempState("nimbus-secret-"));

  for (const value of ["password: azerty", "password: Bitwarden", "password: hunter2"]) {
    assert.equal(inspectSecretLeak(value).leaked, true, value);
    const refused = memory.learn({ key: "mdp", value });
    assert.equal(refused.ok, false, value);
    assert.equal(refused.code, "secret_refused", value);
    assert.match(refused.message, /--force/);
  }

  for (const prose of ["mon gestionnaire est Bitwarden", "j'utilise Bitwarden pour les mots de passe"]) {
    assert.equal(inspectSecretLeak(prose).leaked, false, prose);
    const learned = memory.learn({ key: "gestionnaire", value: prose });
    assert.equal(learned.ok, true, prose);
  }

  const forced = assertNoSecret("password: Bitwarden", "memory", { force: true });
  assert.equal(forced.ok, true);
  assert.equal(forced.forced, true);
  assert.match(forced.warning, /ATTENTION/);
  const stored = memory.learn({ key: "force-mdp", value: "password: Bitwarden", force: true });
  assert.equal(stored.ok, true);
  assert.equal(stored.forced, true);
});
