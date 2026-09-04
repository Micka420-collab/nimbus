import assert from "node:assert/strict";
import { test } from "node:test";
import { authorize, describePermissionModes, normalizePermissionMode } from "../src/permissions.js";

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

test("voice listen requires consent in every mode except when consent is present", () => {
  const silent = authorize({ action: "voice.listen", mode: "ask" });
  assert.equal(silent.allowed, false);
  assert.equal(silent.reason, "consent_required");
  const consented = authorize({
    action: "voice.listen",
    mode: "ask",
    consentGranted: true,
    approved: true,
  });
  assert.equal(consented.allowed, true);
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
