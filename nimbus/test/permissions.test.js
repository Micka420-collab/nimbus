import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  applyToOpenClawConfig,
  authorize,
  describePermissionModes,
  normalizePermissionMode,
  parseOpenClawConfigText,
} from "../src/permissions.js";
import { tempState } from "./helpers.js";

test("unknown mode collapses to deny", () => {
  assert.equal(normalizePermissionMode("yolo"), "deny");
  assert.equal(normalizePermissionMode("ask"), "ask");
});

test("default deny blocks host exec until a human approves", () => {
  const blocked = authorize({ action: "exec", mode: "deny" });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, "default_deny");
  const approved = authorize({ action: "exec", mode: "deny", approved: true });
  assert.equal(approved.allowed, true);
});

test("local-safe reads pass even in deny", () => {
  const read = authorize({ action: "memory.read", mode: "deny" });
  assert.equal(read.allowed, true);
  assert.equal(read.reason, "local_safe");
});

test("workspace writes stay denied until a human approves", () => {
  const blocked = authorize({ action: "workspace.write", mode: "deny" });
  assert.equal(blocked.allowed, false);
  const approved = authorize({ action: "workspace.write", mode: "deny", approved: true });
  assert.equal(approved.allowed, true);
});

test("allowlist misses are silent denies", () => {
  const miss = authorize({ action: "network", mode: "allowlist", allowlist: ["workspace.read"] });
  assert.equal(miss.allowed, false);
  assert.equal(miss.reason, "allowlist_miss");
});

test("ask/auto miss requires a human", () => {
  const ask = authorize({ action: "send", mode: "ask" });
  assert.equal(ask.allowed, false);
  assert.equal(ask.reason, "needs_human");
});

test("permission catalog documents OpenClaw mapping", () => {
  const catalog = describePermissionModes();
  assert.equal(catalog.defaultMode, "deny");
  assert.equal(catalog.openclawMapping.deny, "tools.exec.mode = deny");
});

test("apply creates a deny OpenClaw config and keeps an existing mode", () => {
  const dir = tempState("nimbus-oc-");
  const createdPath = join(dir, "openclaw.json");
  const created = applyToOpenClawConfig(createdPath, { mode: "deny", workspace: join(dir, "ws") });
  assert.equal(created.ok, true);
  assert.equal(created.created, true);
  const disk = JSON.parse(readFileSync(createdPath, "utf8"));
  assert.equal(disk.tools.exec.mode, "deny");
  assert.equal(disk.agents.defaults.workspace, join(dir, "ws"));

  writeFileSync(createdPath, `{
  // existing operator choice
  tools: {
    exec: { mode: "ask", },
  },
}
`);
  const kept = applyToOpenClawConfig(createdPath, { mode: "deny" });
  assert.equal(kept.ok, true);
  assert.equal(kept.mode, "ask");
  assert.equal(kept.skipped[0].reason, "existing_mode_kept");
  assert.equal(parseOpenClawConfigText(readFileSync(createdPath, "utf8")).config.tools.exec.mode, "ask");

  const firstNow = () => new Date("2026-09-04T12:00:00.000Z");
  const forced = applyToOpenClawConfig(createdPath, { mode: "deny", force: true, now: firstNow });
  assert.equal(forced.mode, "deny");
  assert.equal(JSON.parse(readFileSync(createdPath, "utf8")).tools.exec.mode, "deny");
  const firstBak = `${createdPath}.bak-20260904T120000`;
  assert.equal(existsSync(firstBak), true);
  assert.match(readFileSync(firstBak, "utf8"), /ask/);
  assert.match(readFileSync(firstBak, "utf8"), /existing operator choice/);

  const secondNow = () => new Date("2026-09-04T12:00:01.000Z");
  const again = applyToOpenClawConfig(createdPath, { mode: "auto", force: true, now: secondNow });
  assert.equal(again.mode, "auto");
  const secondBak = `${createdPath}.bak-20260904T120001`;
  assert.equal(existsSync(secondBak), true);
  assert.match(readFileSync(firstBak, "utf8"), /existing operator choice/);
  assert.match(readFileSync(firstBak, "utf8"), /ask/);
  assert.equal(JSON.parse(readFileSync(secondBak, "utf8")).tools.exec.mode, "deny");
});
