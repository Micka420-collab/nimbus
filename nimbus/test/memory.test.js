import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemory } from "../src/memory.js";
import { fixedClock, tempState } from "./helpers.js";

test("learns a preference and recalls it", () => {
  const memory = createMemory(tempState(), { now: fixedClock() });
  const learned = memory.learn({ key: "langue", value: "français", kind: "preference" });
  assert.equal(learned.ok, true);
  assert.equal(learned.entry.key, "langue");
  const recalled = memory.recall({ query: "français" });
  assert.equal(recalled.entries.length, 1);
  assert.equal(recalled.entries[0].kind, "preference");
});

test("updates the same key instead of duplicating", () => {
  const memory = createMemory(tempState(), { now: fixedClock() });
  memory.learn({ key: "ville", value: "Lyon" });
  const updated = memory.learn({ key: "Ville", value: "Paris" });
  assert.equal(updated.updated, true);
  assert.equal(memory.list().entries.length, 1);
  assert.equal(memory.list().entries[0].value, "Paris");
});

test("forgets by key and hides the entry from recall", () => {
  const memory = createMemory(tempState(), { now: fixedClock() });
  memory.learn({ key: "theme", value: "sombre" });
  const forgotten = memory.forget({ key: "theme" });
  assert.equal(forgotten.ok, true);
  assert.equal(memory.recall().entries.length, 0);
});

test("refuses API-key shaped secrets", () => {
  const memory = createMemory(tempState(), { now: fixedClock() });
  const refused = memory.learn({
    key: "openai",
    value: "sk-thisisnotarealkeybutlookslikeone",
  });
  assert.equal(refused.ok, false);
  assert.equal(refused.code, "secret_refused");
  assert.equal(memory.list().entries.length, 0);
});

test("records an operator correction", () => {
  const memory = createMemory(tempState(), { now: fixedClock() });
  const learned = memory.learn({
    key: "prenom-prononciation",
    value: "Micka se prononce mi-ka",
    kind: "correction",
    source: "operator",
  });
  assert.equal(learned.ok, true);
  assert.equal(learned.entry.kind, "correction");
});
