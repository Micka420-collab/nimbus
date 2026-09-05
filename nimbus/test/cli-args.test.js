import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { tempState } from "./helpers.js";

const cli = fileURLToPath(new URL("../cli/nimbus.mjs", import.meta.url));

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
}

test("accepts --state before the subcommand", () => {
  const state = tempState("nimbus-cli-");
  const learned = run(["--state", state, "memory", "learn", "--key", "ville", "--value", "Paris"]);
  assert.equal(learned.status, 0, learned.stderr);
  const body = JSON.parse(learned.stdout);
  assert.equal(body.ok, true);
  const listed = run(["--state", state, "memory", "list"]);
  assert.equal(listed.status, 0, listed.stderr);
  assert.equal(JSON.parse(listed.stdout).entries[0].value, "Paris");
});

test("CLI wires twin impact and room without opening a mic", () => {
  const state = tempState("nimbus-cli-");
  const node = run(["--state", state, "twin", "node", "--id", "gateway", "--kind", "service", "--critical"]);
  assert.equal(node.status, 0, node.stderr);
  const impact = run(["--state", state, "twin", "impact", "--target", "gateway", "--action", "exec"]);
  assert.equal(JSON.parse(impact.stdout).blocked, true);
  const room = run(["--state", state, "room", "enter", "--id", "salon"]);
  const body = JSON.parse(room.stdout);
  assert.equal(body.ok, true);
  assert.equal(body.voice.micLive, false);
  assert.equal(body.voice.phase, "muted");
});
