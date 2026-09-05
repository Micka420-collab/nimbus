import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { tempState } from "./helpers.js";

const cli = fileURLToPath(new URL("../cli/nimbus.mjs", import.meta.url));

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
}

test("accepts --state before the subcommand and persists memory on disk", () => {
  const state = tempState("nimbus-cli-");
  const learned = run(["--state", state, "memory", "learn", "--key", "ville", "--value", "Paris"]);
  assert.equal(learned.status, 0, learned.stderr);
  const body = JSON.parse(learned.stdout);
  assert.equal(body.ok, true);
  const listed = run(["--state", state, "memory", "list"]);
  assert.equal(listed.status, 0, listed.stderr);
  assert.equal(JSON.parse(listed.stdout).entries[0].value, "Paris");
  assert.equal(JSON.parse(readFileSync(join(state, "memory.json"), "utf8")).entries[0].value, "Paris");
});

test("CLI colony ledger and approval write real state files", () => {
  const state = tempState("nimbus-cli-");
  const worker = run(["--state", state, "colony", "worker", "--id", "alpha"]);
  assert.equal(worker.status, 0, worker.stderr);
  const task = run(["--state", state, "colony", "task", "--title", "Installer un paquet"]);
  const taskId = JSON.parse(task.stdout).task.id;
  const step = run([
    "--state",
    state,
    "colony",
    "step",
    "--task",
    taskId,
    "--action",
    "exec",
    "--summary",
    "pnpm add left-pad",
  ]);
  const proposed = JSON.parse(step.stdout);
  assert.equal(proposed.step.status, "needs_approval");
  const blocked = run(["--state", state, "colony", "run", "--step", proposed.step.id]);
  assert.equal(JSON.parse(blocked.stdout).ok, false);
  const decided = run([
    "--state",
    state,
    "colony",
    "decide",
    "--step",
    proposed.step.id,
    "--verdict",
    "approve",
  ]);
  assert.equal(JSON.parse(decided.stdout).step.status, "ready");
  const ran = run(["--state", state, "colony", "run", "--step", proposed.step.id]);
  assert.equal(JSON.parse(ran.stdout).step.status, "done");
  const ledger = JSON.parse(readFileSync(join(state, "colony-ledger.json"), "utf8"));
  assert.equal(ledger.steps[0].status, "done");
  assert.equal(JSON.parse(readFileSync(join(state, "trust.json"), "utf8")).tools.exec.approvals, 1);
});

test("CLI permissions apply writes a usable OpenClaw config", () => {
  const dir = tempState("nimbus-cfg-");
  const config = join(dir, "openclaw.json");
  const workspace = join(dir, "workspace");
  const applied = run([
    "permissions",
    "apply",
    "--config",
    config,
    "--workspace",
    workspace,
    "--mode",
    "deny",
  ]);
  assert.equal(applied.status, 0, applied.stderr);
  const body = JSON.parse(applied.stdout);
  assert.equal(body.ok, true);
  assert.equal(body.created, true);
  assert.equal(body.mode, "deny");
  const written = JSON.parse(readFileSync(config, "utf8"));
  assert.equal(written.tools.exec.mode, "deny");
  assert.equal(written.agents.defaults.workspace, workspace);
});

test("CLI profile install produces workspace persona files", () => {
  const workspace = tempState("nimbus-ws-");
  const installed = run(["profile", "install", "--workspace", workspace]);
  assert.equal(installed.status, 0, installed.stderr);
  const body = JSON.parse(installed.stdout);
  assert.equal(body.ok, true);
  assert.ok(existsSync(join(workspace, "SOUL.md")));
  assert.ok(existsSync(join(workspace, "IDENTITY.md")));
  assert.match(readFileSync(join(workspace, "SOUL.md"), "utf8"), /Nimbus/);
});

test("unknown theater commands are not wired", () => {
  const state = tempState("nimbus-cli-");
  const voice = run(["--state", state, "voice", "demo"]);
  assert.equal(voice.status, 1);
  const twin = run(["--state", state, "twin", "graph"]);
  assert.equal(twin.status, 1);
});
