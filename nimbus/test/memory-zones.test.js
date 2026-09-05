import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemory } from "../src/memory.js";
import { tempState } from "./helpers.js";

function clock(start) {
  let current = start;
  return {
    now: () => current,
    set(next) {
      current = next;
    },
  };
}

test("stores zone tags and forgets a whole zone", () => {
  const memory = createMemory(tempState(), { now: () => "2026-09-04T12:00:00.000Z" });
  memory.learn({ key: "anniv", value: "juin", zone: "perso" });
  memory.learn({ key: "repo", value: "nimbus", zone: "tech" });
  memory.learn({ key: "alias", value: "Micka", zone: "kollega" });
  assert.equal(memory.recall({ zone: "collegue" }).entries[0].key, "alias");
  const forgotten = memory.forgetZone("perso");
  assert.equal(forgotten.ok, true);
  assert.equal(memory.recall({ zone: "perso" }).entries.length, 0);
  assert.equal(memory.recall({ zone: "tech" }).entries.length, 1);
});

test("TTL expires entries without a secret leak path", () => {
  const time = clock("2026-09-04T12:00:00.000Z");
  const memory = createMemory(tempState(), { now: time.now });
  memory.learn({ key: "tmp", value: "post-it", ttl: 1 });
  assert.equal(memory.recall().entries.length, 1);
  time.set("2026-09-04T13:30:00.000Z");
  assert.equal(memory.recall().entries.length, 0);
});

test("forget-by-weekend only drops weekend-tagged memories", () => {
  const memory = createMemory(tempState(), { now: () => "2026-09-04T12:00:00.000Z" });
  memory.learn({ key: "courses", value: "lait", ttl: "weekend", zone: "perso" });
  memory.learn({ key: "stack", value: "OpenClaw", zone: "tech" });
  const wiped = memory.forgetWeekend();
  assert.equal(wiped.forgotten.length, 1);
  assert.equal(memory.recall().entries[0].key, "stack");
});

test("still refuses secrets when a zone and TTL are set", () => {
  const memory = createMemory(tempState(), { now: () => "2026-09-04T12:00:00.000Z" });
  const refused = memory.learn({
    key: "token",
    value: "ghp_abcdefghijklmnopqrstuvwxyz123456",
    zone: "tech",
    ttl: "weekend",
  });
  assert.equal(refused.code, "secret_refused");
  assert.equal(memory.list().entries.length, 0);
});
